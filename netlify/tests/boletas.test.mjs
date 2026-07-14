import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import {__test, DUPLICATE_QUERY_LIMIT, HISTORY_PAGE_SIZE, SALES_LOOKUP_LIMIT} from '../functions/boletas.mjs';

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
  assert.equal(parsed.boletaData.emisor.ciudad, 'Orlando, FL 32801');
  assert.equal(parsed.boletaData.emisor.logoDataUrl, '');
});

test('legacy issuer config does not create an empty format 4 override', () => {
  const config = __test.normalizeConfig({formato1: {nombre: 'EMPRESA', rut: '1-9', direccion: 'DIRECCION'}});
  assert.ok(config.formato1);
  assert.equal(config.formato4, undefined);
});
