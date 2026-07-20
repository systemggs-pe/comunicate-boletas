import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {__test, dispatchBoletas, DUPLICATE_QUERY_LIMIT, HISTORY_PAGE_SIZE, SALES_LOOKUP_LIMIT} from '../functions/boletas.mjs';
import {
  getBoletaExtranjeraEmisorParaImpresion,
  guardarBoletaExtranjeraLogoLocal,
  mergeBoletaExtranjeraEmisores,
} from '../../src/config/boletaExtranjera.js';
import {penToUsd} from '../../src/utils/currency.js';
import {crearReferenciaFormato6, formatearNumeroOrdenFormato5} from '../../src/features/boletas/boletaPdf.js';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));

class ConflictError extends Error {}

class Snapshot {
  constructor(ref, value) {
    this.ref = ref;
    this.id = ref.id;
    this.exists = value !== undefined;
    this._value = value;
  }
  data() { return this._value; }
}

class QuerySnapshot {
  constructor(docs) { this.docs = docs; }
}

class DocumentRef {
  constructor(db, path) { this.db = db; this.path = path; this.id = path.split('/').at(-1); }
  collection(name) { return new CollectionRef(this.db, `${this.path}/${name}`); }
  get() { return this.db.readDocument(this); }
  set(value, options) { return this.db.writeDocument(this, value, options); }
}

class Query {
  constructor(collection, options = {}) { this.collection = collection; this.options = options; }
  where(field, operator, value) { return new Query(this.collection, {...this.options, where: [field, operator, value]}); }
  orderBy(field, direction = 'asc') { return new Query(this.collection, {...this.options, orderBy: [field, direction]}); }
  limit(value) { return new Query(this.collection, {...this.options, limit: value}); }
  startAfter(snapshot) { return new Query(this.collection, {...this.options, startAfter: snapshot.id}); }
  get() { return this.collection.db.readQuery(this); }
}

class CollectionRef extends Query {
  constructor(db, path) {
    const collection = {db, path};
    super(collection);
    this.db = db;
    this.path = path;
    this.collection = this;
  }
  doc(id) { return new DocumentRef(this.db, `${this.path}/${id}`); }
}

class Transaction {
  constructor(db) { this.db = db; this.readVersions = new Map(); this.writes = []; }
  async get(target) {
    await new Promise(resolve => setImmediate(resolve));
    if (target instanceof DocumentRef) {
      this.readVersions.set(target.path, this.db.version(target.path));
      return this.db.readDocument(target);
    }
    const snapshot = await this.db.readQuery(target);
    snapshot.docs.forEach(doc => this.readVersions.set(doc.ref.path, this.db.version(doc.ref.path)));
    return snapshot;
  }
  set(ref, value, options) { this.writes.push({type: 'set', ref, value, options}); }
  delete(ref) { this.writes.push({type: 'delete', ref}); }
  commit() {
    for (const [path, version] of this.readVersions) {
      if (this.db.version(path) !== version) throw new ConflictError('transaction conflict');
    }
    for (const write of this.writes) {
      if (write.type === 'delete') this.db.deleteDocument(write.ref);
      else this.db.writeDocument(write.ref, write.value, write.options);
    }
  }
}

class FakeDb {
  constructor(seed = {}) {
    this.documents = new Map(Object.entries(seed));
    this.versions = new Map([...this.documents.keys()].map(path => [path, 1]));
    this.metrics = {documentReads: 0, queryDocumentReads: 0, queries: []};
  }
  collection(name) { return new CollectionRef(this, name); }
  version(path) { return this.versions.get(path) || 0; }
  async readDocument(ref) {
    this.metrics.documentReads += 1;
    return new Snapshot(ref, this.documents.get(ref.path));
  }
  async readQuery(query) {
    const {path} = query.collection;
    let docs = [...this.documents.entries()]
      .filter(([documentPath]) => documentPath.startsWith(`${path}/`) && documentPath.slice(path.length + 1).split('/').length === 1)
      .map(([documentPath, value]) => new Snapshot(new DocumentRef(this, documentPath), value));
    const where = query.options.where;
    if (where) {
      const [field, operator, expected] = where;
      docs = docs.filter(doc => operator === 'array-contains'
        ? Array.isArray(doc.data()?.[field]) && doc.data()[field].includes(expected)
        : doc.data()?.[field] === expected);
    }
    const orderBy = query.options.orderBy;
    if (orderBy) {
      const [field, direction] = orderBy;
      docs.sort((a, b) => {
        const left = new Date(a.data()?.[field] || 0).getTime();
        const right = new Date(b.data()?.[field] || 0).getTime();
        return direction === 'desc' ? right - left : left - right;
      });
    }
    if (query.options.startAfter) {
      const index = docs.findIndex(doc => doc.id === query.options.startAfter);
      docs = index >= 0 ? docs.slice(index + 1) : docs;
    }
    if (Number.isFinite(query.options.limit)) docs = docs.slice(0, query.options.limit);
    this.metrics.queries.push({path, where, limit: query.options.limit, reads: docs.length});
    this.metrics.queryDocumentReads += docs.length;
    return new QuerySnapshot(docs);
  }
  writeDocument(ref, value, options = {}) {
    const current = this.documents.get(ref.path) || {};
    this.documents.set(ref.path, options?.merge ? {...current, ...value} : value);
    this.versions.set(ref.path, this.version(ref.path) + 1);
  }
  deleteDocument(ref) {
    this.documents.delete(ref.path);
    this.versions.set(ref.path, this.version(ref.path) + 1);
  }
  async runTransaction(callback) {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const transaction = new Transaction(this);
      try {
        const result = await callback(transaction);
        transaction.commit();
        return result;
      } catch (error) {
        if (error instanceof ConflictError) continue;
        throw error;
      }
    }
    throw new Error('transaction retries exhausted');
  }
}

const basePath = 'artifacts/comunicate-pos/users/shared';
const validPayload = imei => ({
  action: 'save',
  formato: 1,
  boletaData: {
    cliente: {nombre: 'CLIENTE PRUEBA', dni: '12345678'},
    ventas: [{imeiEquipo: imei, marcaEquipo: 'MARCA', modeloEquipo: 'MODELO', precio: '100'}],
    equiposMap: {[imei]: {marca: 'MARCA', modelo: 'MODELO'}},
    totalClp: 25000,
    fechaHora: '2026-07-11T10:30:00',
    emisor: {nombre: 'EMPRESA', rut: '12.345.678-9', direccion: 'DIRECCION'},
  },
});

test('historial is paginated to 50 documents and never scans the full collection', async () => {
  const seed = {};
  for (let index = 0; index < 80; index += 1) {
    seed[`${basePath}/boletasExtranjeras/b-${index}`] = {nBoleta: 1000 + index, createdAt: new Date(2026, 0, index + 1), boletaData: {}};
  }
  const db = new FakeDb(seed);
  const result = await __test.listBoletas(db, {});
  assert.equal(HISTORY_PAGE_SIZE, 50);
  assert.equal(result.boletas.length, 50);
  assert.equal(result.hasMore, true);
  assert.equal(db.metrics.queryDocumentReads, 51);
});

test('sales lookup reads only one client, matching sales, and their IMEIs', async () => {
  const dni = '12345678';
  const imeis = ['123456789012345', '987654321098765'];
  const seed = {
    [`${basePath}/clientes/${dni}`]: {nombre: 'CLIENTE'},
    [`${basePath}/ventas/v1`]: {dniCliente: dni, imeiEquipo: imeis[0], fecha: '2026-07-10', precio: '100'},
    [`${basePath}/ventas/v2`]: {dniCliente: dni, imeiEquipo: imeis[1], fecha: '2026-07-11', precio: '200'},
    [`${basePath}/ventas/other`]: {dniCliente: '99999999', imeiEquipo: '111111111111111'},
    [`${basePath}/equipos/${imeis[0]}`]: {marca: 'A'},
    [`${basePath}/equipos/${imeis[1]}`]: {marca: 'B'},
  };
  const db = new FakeDb(seed);
  const result = await __test.lookupSales(db, {dni});
  assert.equal(SALES_LOOKUP_LIMIT, 50);
  assert.equal(result.ventas.length, 2);
  assert.equal(result.equipos.length, 2);
  assert.equal(db.metrics.documentReads, 3);
  assert.equal(db.metrics.queryDocumentReads, 2);
  assert.equal(db.metrics.queries.filter(query => query.path.endsWith('/ventas')).length, 1);
});

test('sales lookup supports legacy numeric DNI values without adding reads to normal lookups', async () => {
  const dni = '12345678';
  const imei = '123456789012345';
  const db = new FakeDb({
    [`${basePath}/clientes/${dni}`]: {nombre: 'CLIENTE ANTIGUO'},
    [`${basePath}/ventas/legacy`]: {dniCliente: Number(dni), imeiEquipo: imei, fecha: '2025-12-01', precio: '150'},
    [`${basePath}/equipos/${imei}`]: {marca: 'LEGACY'},
  });

  const result = await __test.lookupSales(db, {dni});

  assert.equal(result.ventas.length, 1);
  assert.equal(result.ventas[0].dniCliente, dni);
  assert.equal(result.equipos.length, 1);
  assert.equal(db.metrics.queries.filter(query => query.path.endsWith('/ventas')).length, 2);
});

test('sales lookup falls back to the operational Ventas backend when the boletas project is empty', async () => {
  const dni = '12345678';
  const imei = '123456789012345';
  const db = new FakeDb();
  let forwardedRequest = null;

  const result = await __test.lookupSales(db, {dni}, {
    authorization: 'Bearer firebase-token',
    fetchImpl: async (url, options) => {
      forwardedRequest = {url, options};
      return {
        ok: true,
        status: 200,
        json: async () => ({
          clientes: [{
            dni,
            nombre: 'CLIENTE OPERATIVO',
            celular: '999999999',
            ventas: [{id: 'venta-real', dniCliente: dni, imeiEquipo: imei, precio: '150', fecha: '2026-07-12'}],
            equipos: [{idEquipo: imei, marca: 'XIAOMI'}],
          }],
        }),
      };
    },
  });

  assert.match(forwardedRequest.url, /comunicate-registros-v2\.netlify\.app\/api\/clientes$/);
  assert.equal(forwardedRequest.options.headers.Authorization, 'Bearer firebase-token');
  assert.deepEqual(JSON.parse(forwardedRequest.options.body), {
    action: 'queryOperational',
    searchTerm: dni,
    searchField: 'dni',
    limit: 1,
  });
  assert.equal(result.cliente.nombre, 'CLIENTE OPERATIVO');
  assert.equal(result.ventas[0].id, 'venta-real');
  assert.equal(result.equipos[0].idEquipo, imei);
});

test('the sales UI exposes the sale-receipt action and local development has an operational proxy', async () => {
  const [frontend, client, viteConfig] = await Promise.all([
    readFile(`${ROOT}/src/features/boletas/BoletaExtranjera.jsx`, 'utf8'),
    readFile(`${ROOT}/src/services/functionsClient.js`, 'utf8'),
    readFile(`${ROOT}/vite.config.js`, 'utf8'),
  ]);

  assert.match(frontend, /Generar boleta de venta/);
  assert.match(frontend, /venta encontrada/);
  assert.match(client, /operational-api\/api\/clientes/);
  assert.match(viteConfig, /comunicate-registros-v2\.netlify\.app/);
});

test('mobile layout keeps touch controls usable and prevents horizontal overflow regressions', async () => {
  const [frontend, styles] = await Promise.all([
    readFile(`${ROOT}/src/features/boletas/BoletaExtranjera.jsx`, 'utf8'),
    readFile(`${ROOT}/src/index.css`, 'utf8'),
  ]);

  assert.match(frontend, /className="boleta-form-actions/);
  assert.match(frontend, /className="sale-summary/);
  assert.match(styles, /\.boleta-workspace, \.saas-form-shell \{ overflow: visible; \}/);
  assert.match(styles, /font-size: 1rem;/);
  assert.match(styles, /@media \(max-width: 350px\)/);
  assert.doesNotMatch(styles, /\.boleta-workspace \.flex\.justify-between\.pt-2\.border-t/);
});

test('two concurrent saves for the same IMEI produce exactly one boleta', async () => {
  const imei = '123456789012345';
  const db = new FakeDb();
  const results = await Promise.allSettled([
    __test.saveBoleta(db, validPayload(imei)),
    __test.saveBoleta(db, validPayload(imei)),
  ]);
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const rejected = results.find(result => result.status === 'rejected');
  assert.equal(rejected.reason.message, 'BOLETA_EQUIPO_YA_EXISTE');
  const saved = [...db.documents.keys()].filter(path => path.startsWith(`${basePath}/boletasExtranjeras/`));
  assert.equal(saved.length, 1);
  assert.ok(db.documents.has(`${basePath}/_boletaEquipoLocks/${imei}`));
});

test('save duplicate checks are bounded and frontend contains no Firestore listener', async () => {
  assert.equal(DUPLICATE_QUERY_LIMIT, 2);
  const backend = await readFile(`${ROOT}/netlify/functions/boletas.mjs`, 'utf8');
  const frontend = await readFile(`${ROOT}/src/features/boletas/BoletaExtranjera.jsx`, 'utf8');
  assert.doesNotMatch(backend, /transaction\.get\(boletasRef\)/);
  assert.match(backend, /array-contains/);
  assert.doesNotMatch(frontend, /onSnapshot|firebase\/firestore|collection\(/);
});

test('format 4 accepts expanded issuer data and a bounded image logo', () => {
  const payload = validPayload('123456789012345');
  payload.formato = 4;
  payload.boletaData.totalUsd = 999;
  payload.boletaData.emisor = {
    nombre: 'NORTHLINE RETAIL INC.',
    rut: 'SIMULADO',
    direccion: '702 Market Avenue',
    ciudad: 'Orlando, FL 32801',
    pais: 'United States',
    email: 'support@example.com',
    telefono: '+1 407 555 0184',
    sitioWeb: 'example.com',
    impuestoPorcentaje: '5',
    logoDataUrl: 'data:image/jpeg;base64,ZmFrZQ==',
  };
  const parsed = __test.normalizeBoletaPayload(payload);
  assert.equal(parsed.formato, 4);
  assert.equal(parsed.boletaData.totalUsd, 26.67);
  assert.equal(parsed.boletaData.emisor.ciudad, 'Orlando, FL 32801');
  assert.equal(parsed.boletaData.emisor.logoDataUrl, '');
});

test('legacy issuer config does not create an empty format 4 override', () => {
  const config = __test.normalizeConfig({formato1: {nombre: 'EMPRESA', rut: '1-9', direccion: 'DIRECCION'}});
  assert.ok(config.formato1);
  assert.equal(config.formato4, undefined);
});

test('format 4 never inherits issuer data stored by format 1', () => {
  const config = {
    formato1: {nombre: 'EMISOR UNO', rut: '1-9', direccion: 'DIRECCION UNO'},
    formato4: {nombre: 'EMISOR CUATRO', rut: '4-9', direccion: 'DIRECCION CUATRO', logoDataUrl: 'data:image/jpeg;base64,ZmFrZQ=='},
  };
  const storedFormat1 = {
    formato: 1,
    emisor: {nombre: 'EMISOR HISTORICO UNO', rut: '11-9', direccion: 'DIRECCION HISTORICA'},
  };

  const format4 = getBoletaExtranjeraEmisorParaImpresion(config, 4, storedFormat1);
  assert.equal(format4.nombre, 'EMISOR CUATRO');
  assert.equal(format4.rut, '4-9');
  assert.equal(format4.logoDataUrl, 'data:image/jpeg;base64,ZmFrZQ==');

  const format1 = getBoletaExtranjeraEmisorParaImpresion(config, 1, storedFormat1);
  assert.equal(format1.nombre, 'EMISOR HISTORICO UNO');
});

test('format 4 configuration preserves its logo data', () => {
  const logoDataUrl = 'data:image/jpeg;base64,ZmFrZQ==';
  const config = __test.normalizeConfig({
    formato4: {nombre: 'EMISOR CUATRO', rut: '4-9', direccion: 'DIRECCION CUATRO', logoDataUrl, tipoCambioPenUsd: '3.75'},
  });
  assert.equal(config.formato4.logoDataUrl, logoDataUrl);
  assert.equal(config.formato4.tipoCambioPenUsd, '3.75');
});

test('format 4 converts PEN amounts to USD with two decimals', () => {
  assert.equal(penToUsd(1000, 3.75), 266.67);
  assert.equal(penToUsd(1000, 0), 0);
});

test('format 4 PDF keeps the invoice layout in USD with an English long date', async () => {
  const source = await readFile(`${ROOT}/src/features/boletas/boletaPdf.js`, 'utf8');
  const format4 = source.slice(
    source.indexOf('export async function generarBoletaExtranjera4'),
    source.indexOf('export async function generarBoletaExtranjera5'),
  );
  assert.match(format4, /penToUsd\(sourceTotalPen/);
  assert.match(format4, /format: 'letter'/);
  assert.match(format4, /INVOICE #/);
  assert.match(format4, /DESCRIPTION/);
  assert.match(format4, /AMOUNT/);
  assert.match(format4, /Intl\.DateTimeFormat\('en-US'/);
  assert.match(format4, /month: 'long'/);
});

test('format 5 is independent, stored in USD, and uses the A4 marketplace template', async () => {
  const payload = validPayload('123456789012346');
  payload.formato = 5;
  payload.boletaData.emisor = {
    nombre: 'mobileusa',
    rut: 'SIMULADO',
    direccion: '9990 NW 14th St, Ste 110',
    ciudad: 'Doral, Florida 33192-2702',
    pais: 'United States',
    vendedor: 'coloradoforsale',
    tipoCambioPenUsd: '3.75',
    impuestoPorcentaje: '5',
  };
  const parsed = __test.normalizeBoletaPayload(payload);
  assert.equal(parsed.formato, 5);
  assert.equal(parsed.boletaData.totalUsd, 26.67);
  assert.equal(parsed.boletaData.emisor.vendedor, 'coloradoforsale');

  const config = __test.normalizeConfig({
    formato5: {...payload.boletaData.emisor, logoDataUrl: 'data:image/jpeg;base64,ZmFrZQ=='},
  });
  assert.equal(config.formato5.nombre, 'mobileusa');
  assert.equal(config.formato5.logoDataUrl, 'data:image/jpeg;base64,ZmFrZQ==');

  const source = await readFile(`${ROOT}/src/features/boletas/boletaPdf.js`, 'utf8');
  const format5 = source.slice(source.indexOf('export async function generarBoletaExtranjera5'));
  assert.match(format5, /format: 'a4'/);
  assert.match(format5, /Order information/);
  assert.match(format5, /Shipping address/);
  assert.match(format5, /Items bought from/);
  assert.match(format5, /5\.08, 2\.71/);
  assert.match(format5, /BOLETA5-/);
});

test('format 5 order number combines month, day, year and the receipt suffix', () => {
  const fecha = '2026-07-15T12:00:00-05:00';
  assert.equal(formatearNumeroOrdenFormato5(1006, fecha), '07-15202-61006');
  assert.equal(formatearNumeroOrdenFormato5('26-12838-58886', fecha), '07-15202-68886');
  assert.equal(formatearNumeroOrdenFormato5('991234567890123', fecha), '07-15202-60123');
  assert.match(formatearNumeroOrdenFormato5('', fecha), /^\d{2}-\d{5}-\d{5}$/);
});

test('format 5 logo survives leaving settings even if the deployed backend omits format 5', () => {
  const storage = new Map();
  const previousWindow = globalThis.window;
  globalThis.window = {
    localStorage: {
      getItem: key => storage.get(key) || null,
      setItem: (key, value) => storage.set(key, value),
    },
  };

  try {
    const logoDataUrl = 'data:image/jpeg;base64,ZmFrZQ==';
    guardarBoletaExtranjeraLogoLocal(5, logoDataUrl);
    const reloaded = mergeBoletaExtranjeraEmisores({
      formato4: {nombre: 'FORMATO CUATRO', logoDataUrl: 'data:image/jpeg;base64,NA=='},
    });
    assert.equal(reloaded.formato5.logoDataUrl, logoDataUrl);
    assert.equal(reloaded.formato4.logoDataUrl, 'data:image/jpeg;base64,NA==');
  } finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
});

test('format 5 logo survives a backend save and reload round trip', async () => {
  const db = new FakeDb();
  const logoDataUrl = 'data:image/jpeg;base64,ZmFrZQ==';
  await dispatchBoletas(db, {
    action: 'saveConfig',
    config: {
      formato5: {
        nombre: 'mobileusa',
        rut: 'SIMULADO',
        direccion: '9990 NW 14th St, Ste 110',
        tipoCambioPenUsd: '3.75',
        logoDataUrl,
      },
    },
  });
  const reloaded = await dispatchBoletas(db, {action: 'getConfig'});
  assert.equal(reloaded.config.formato5.logoDataUrl, logoDataUrl);
});

test('format 6 is independent, stored in USD, and preserves Apple receipt fields', () => {
  const payload = validPayload('123456789012347');
  payload.formato = 6;
  payload.boletaData.emisor = {
    nombre: 'Apple Columbia',
    rut: 'SIMULADO',
    direccion: '10300 Little Patuxent Parkway, Space 2040',
    ciudad: 'Columbia, MD 21044',
    tipoCambioPenUsd: '3.75',
    impuestoPorcentaje: '6',
    tarjetaUltimos4: '3282',
    codigoTerminal: '025039',
    applicationId: 'A0000000042203',
    applicationPanSequence: '00',
    deviceId: '0565',
    cardType: 'Debit',
    tvr: '0000008001',
    tsi: 'E800',
    diasDevolucion: '16',
    partNumber: 'MPUA3LL/A',
  };
  const parsed = __test.normalizeBoletaPayload(payload);
  assert.equal(parsed.formato, 6);
  assert.equal(parsed.boletaData.totalUsd, 26.67);
  assert.equal(parsed.boletaData.emisor.applicationId, 'A0000000042203');
  assert.equal(parsed.boletaData.emisor.tarjetaUltimos4, '3282');
});

test('format 6 follows the measured Letter receipt geometry and dynamic barcode', async () => {
  const source = await readFile(`${ROOT}/src/features/boletas/boletaPdf.js`, 'utf8');
  const format6 = source.slice(source.indexOf('export async function generarBoletaExtranjera6'));
  assert.match(format6, /format: 'letter'/);
  assert.match(format6, /doc\.line\(144, y, 468, y\)/);
  assert.match(format6, /rule\(178\.54\)/);
  assert.match(format6, /JsBarcode\(barcodeTarget, reference\.barcode/);
  assert.match(format6, /APPLE_RECEIPT_LOGO/);
  assert.match(format6, /Payment Method/);
  assert.match(format6, /Application PAN Sequence Number/);
  assert.match(format6, /BOLETA6-/);

  const reference = crearReferenciaFormato6('1681153706', '2023-10-22T13:21:00-04:00');
  assert.equal(reference.barcode, '20231022R1681153706');
  assert.equal(reference.reference, 'R1681153706');
});

test('format 1 uses the 80 mm SII receipt layout with a real PDF417 stamp', async () => {
  const source = await readFile(`${ROOT}/src/features/boletas/boletaPdf.js`, 'utf8');
  const start = source.indexOf('export async function generarBoletaExtranjera({');
  const end = source.indexOf('export async function generarBoletaExtranjera2', start);
  const format1 = source.slice(start, end);

  assert.match(format1, /const mmW = 80/);
  assert.match(format1, /getPdf417Generator\(\)/);
  assert.match(format1, /gen417\(texto417, 2, 4\)/);
  assert.match(format1, /doc\.rect\(13, y, 54, 24\)/);
  assert.match(format1, /BOLETA ELECTRÓNICA/);
  assert.match(format1, /S\.I\.I\. -/);
  assert.match(format1, /DATOS DEL CLIENTE/);
  assert.match(format1, /detailField\('NOMBRE'/);
  assert.match(format1, /detailField\('DNI \/ RUT'/);
  assert.match(format1, /detailField\('EQUIPO'/);
  assert.match(format1, /detailField\('COLOR'/);
  assert.match(format1, /detailField\('MEMORIA'/);
  assert.match(format1, /detailField\('IMEI'/);
  assert.match(format1, /Timbre Electrónico SII/);
  assert.doesNotMatch(format1, /CODE128/);
});
