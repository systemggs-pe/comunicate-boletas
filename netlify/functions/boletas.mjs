import admin from 'firebase-admin';
import {handlePost} from './_shared.mjs';
import {getAdminDb} from './_firebaseAdmin.mjs';

const APP_ID = 'comunicate-pos';
const SCOPE = 'shared';
export const HISTORY_PAGE_SIZE = 50;
export const SALES_LOOKUP_LIMIT = 50;
export const DUPLICATE_QUERY_LIMIT = 2;
const OPERATIONAL_CLIENTS_URL = String(
  process.env.OPERATIONAL_CLIENTS_URL || 'https://comunicate-registros-v2.netlify.app/api/clientes',
).trim();

function baseRef(db) {
  return db.collection('artifacts').doc(APP_ID).collection('users').doc(SCOPE);
}

function cleanText(value, max = 300) {
  return String(value || '').trim().slice(0, max);
}

function cleanDni(value) {
  const dni = String(value || '').replace(/\D/g, '').slice(0, 12);
  return /^\d{6,12}$/.test(dni) ? dni : '';
}

function cleanImei(value) {
  const imei = String(value || '').replace(/\D/g, '').slice(0, 15);
  return /^\d{15}$/.test(imei) ? imei : '';
}

function cleanMoney(value) {
  const amount = Number(value || 0);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
}

function normalizeVentas(value) {
  return Array.isArray(value) ? value.slice(0, 20).map(sale => ({
    id: cleanText(sale?.id, 160),
    imeiEquipo: cleanImei(sale?.imeiEquipo),
    imei2Equipo: cleanImei(sale?.imei2Equipo),
    sn: cleanText(sale?.sn, 80),
    marcaEquipo: cleanText(sale?.marcaEquipo, 80),
    modeloEquipo: cleanText(sale?.modeloEquipo, 100),
    nombreComercial: cleanText(sale?.nombreComercial, 140),
    memoria: cleanText(sale?.memoria, 20),
    color: cleanText(sale?.color, 80),
    precio: cleanText(sale?.precio, 20),
  })).filter(sale => sale.imeiEquipo && Number(sale.precio) > 0) : [];
}

function normalizeEquiposMap(value, ventas) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return ventas.reduce((result, sale) => {
    const equipment = source[sale.imeiEquipo] || {};
    result[sale.imeiEquipo] = {
      imei2: cleanImei(equipment.imei2 || sale.imei2Equipo),
      sn: cleanText(equipment.sn || sale.sn, 80),
      marca: cleanText(equipment.marca || sale.marcaEquipo, 80),
      modelo: cleanText(equipment.modelo || sale.modeloEquipo, 100),
      nombreComercial: cleanText(equipment.nombreComercial || sale.nombreComercial, 140),
      memoria: cleanText(equipment.memoria || sale.memoria, 20),
      color: cleanText(equipment.color || sale.color, 80),
    };
    return result;
  }, {});
}

function normalizeEmisor(value) {
  const emitter = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const logoDataUrl = cleanText(emitter.logoDataUrl, 300000);
  return {
    nombre: cleanText(emitter.nombre, 180),
    rut: cleanText(emitter.rut, 40),
    direccion: cleanText(emitter.direccion, 220),
    giro1: cleanText(emitter.giro1, 120),
    giro2: cleanText(emitter.giro2, 120),
    comuna: cleanText(emitter.comuna, 80),
    ciudad: cleanText(emitter.ciudad, 80),
    vendedor: cleanText(emitter.vendedor, 40),
    pais: cleanText(emitter.pais, 80),
    email: cleanText(emitter.email, 140),
    telefono: cleanText(emitter.telefono, 60),
    sitioWeb: cleanText(emitter.sitioWeb, 180),
    metodoPago: cleanText(emitter.metodoPago, 80),
    impuestoPorcentaje: cleanText(emitter.impuestoPorcentaje, 10),
    notas: cleanText(emitter.notas, 400),
    terminos: cleanText(emitter.terminos, 220),
    logoDataUrl: /^data:image\/(?:png|jpe?g|webp);base64,/i.test(logoDataUrl) ? logoDataUrl : '',
  };
}

function normalizeBoletaPayload(payload) {
  const action = cleanText(payload?.action, 20);
  if (!['save', 'update'].includes(action)) throw Object.assign(new Error('ACTION_INVALIDA'), {status: 400});
  const formato = Number(payload.formato);
  if (![1, 2, 3, 4].includes(formato)) throw Object.assign(new Error('FORMATO_INVALIDO'), {status: 400});

  const raw = payload.boletaData || {};
  const ventas = normalizeVentas(raw.ventas);
  if (!ventas.length) throw Object.assign(new Error('BOLETA_SIN_EQUIPO'), {status: 400});
  const equiposMap = normalizeEquiposMap(raw.equiposMap, ventas);
  const equipoKeys = Array.from(new Set(ventas.flatMap(sale => [
    cleanImei(sale.imeiEquipo),
    cleanImei(sale.imei2Equipo),
    cleanImei(equiposMap[sale.imeiEquipo]?.imei2),
  ]).filter(Boolean)));
  const fechaHora = cleanText(raw.fechaHora, 40);
  if (!fechaHora || Number.isNaN(Date.parse(fechaHora))) throw Object.assign(new Error('FECHA_INVALIDA'), {status: 400});

  const boletaData = {
    cliente: {nombre: cleanText(raw.cliente?.nombre, 180), dni: cleanText(raw.cliente?.dni, 20)},
    ventas,
    equiposMap,
    totalClp: cleanMoney(raw.totalClp),
    fechaHora,
    nBoleta: Number.isInteger(Number(raw.nBoleta)) ? Number(raw.nBoleta) : null,
    emisor: {...normalizeEmisor(raw.emisor), logoDataUrl: ''},
  };
  if (!boletaData.cliente.nombre || !boletaData.cliente.dni) throw Object.assign(new Error('CLIENTE_INVALIDO'), {status: 400});
  if (!boletaData.totalClp) throw Object.assign(new Error('TOTAL_INVALIDO'), {status: 400});
  return {
    action,
    formato,
    historialId: cleanText(payload.historialId, 180),
    boletaData,
    equipoKeys,
    totalPen: ventas.reduce((sum, sale) => sum + cleanMoney(sale.precio), 0),
    origen: ventas.some(sale => sale.id) ? 'ventas' : 'manual',
  };
}

function equipmentKeys(data = {}) {
  const stored = Array.isArray(data.boletaEquipoKeys) ? data.boletaEquipoKeys : [];
  const sales = Array.isArray(data.boletaData?.ventas) ? data.boletaData.ventas : [];
  return Array.from(new Set([
    ...stored,
    data.boletaEquipoKey,
    ...sales.flatMap(sale => [sale.imeiEquipo, sale.imei2Equipo]),
  ].map(cleanImei).filter(Boolean)));
}

function timestampIso(value) {
  if (!value) return '';
  if (typeof value.toDate === 'function') return value.toDate().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function safeBoleta(id, data = {}) {
  return {
    id,
    nBoleta: data.nBoleta || data.boletaData?.nBoleta || null,
    clienteDni: cleanText(data.clienteDni || data.boletaData?.cliente?.dni, 20),
    clienteNombre: cleanText(data.clienteNombre || data.boletaData?.cliente?.nombre, 180),
    totalPen: cleanMoney(data.totalPen),
    totalClp: cleanMoney(data.totalClp || data.boletaData?.totalClp),
    fechaHora: cleanText(data.fechaHora || data.boletaData?.fechaHora, 40),
    formato: Number(data.formato || 1),
    origen: cleanText(data.origen, 20),
    boletaEquipoKey: cleanImei(data.boletaEquipoKey),
    boletaEquipoKeys: equipmentKeys(data),
    boletaData: data.boletaData || {},
    createdAt: timestampIso(data.createdAt),
    updatedAt: timestampIso(data.updatedAt),
  };
}

async function listBoletas(db, payload) {
  const ref = baseRef(db).collection('boletasExtranjeras');
  const cursorId = cleanText(payload.cursor, 180);
  let query = ref.orderBy('createdAt', 'desc').limit(HISTORY_PAGE_SIZE + 1);
  if (cursorId) {
    const cursor = await ref.doc(cursorId).get();
    if (!cursor.exists) throw Object.assign(new Error('CURSOR_INVALIDO'), {status: 400});
    query = ref.orderBy('createdAt', 'desc').startAfter(cursor).limit(HISTORY_PAGE_SIZE + 1);
  }
  const snap = await query.get();
  const page = snap.docs.slice(0, HISTORY_PAGE_SIZE);
  return {
    boletas: page.map(doc => safeBoleta(doc.id, doc.data())),
    hasMore: snap.docs.length > HISTORY_PAGE_SIZE,
    nextCursor: page.at(-1)?.id || '',
  };
}

function mapOperationalLookup(data, dni) {
  const clientes = Array.isArray(data?.clientes) ? data.clientes : [];
  const source = clientes.find(item => cleanDni(item?.dni || item?.id) === dni);
  if (!source) return null;
  const ventas = Array.isArray(source.ventas)
    ? source.ventas.map(sale => ({...sale, dniCliente: dni}))
      .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0))
    : [];
  if (!ventas.length) return null;
  return {
    cliente: {
      dni,
      nombre: cleanText(source.nombre || ventas[0]?.nombreCliente || dni, 180),
      celular: cleanText(source.celular || ventas[0]?.celularCliente, 30),
      tipoDocumento: cleanText(source.tipoDocumento || ventas[0]?.tipoDocumentoCliente || 'DNI', 30),
    },
    ventas,
    equipos: Array.isArray(source.equipos) ? source.equipos : [],
  };
}

async function lookupOperationalSales(dni, authorization, fetchImpl = fetch) {
  if (!authorization || !OPERATIONAL_CLIENTS_URL) return null;
  const response = await fetchImpl(OPERATIONAL_CLIENTS_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: authorization,
    },
    body: JSON.stringify({
      action: 'queryOperational',
      searchTerm: dni,
      searchField: 'dni',
      limit: 1,
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(data.error || 'VENTAS_BACKEND_NO_DISPONIBLE'), {
      status: response.status >= 400 && response.status < 500 ? response.status : 502,
    });
  }
  return mapOperationalLookup(data, dni);
}

async function lookupSales(db, payload, options = {}) {
  const dni = cleanDni(payload.dni);
  if (!dni) throw Object.assign(new Error('DNI_INVALIDO'), {status: 400});
  const base = baseRef(db);
  const [clientSnap, stringSalesSnap] = await Promise.all([
    base.collection('clientes').doc(dni).get(),
    base.collection('ventas').where('dniCliente', '==', dni).limit(SALES_LOOKUP_LIMIT).get(),
  ]);
  let salesDocs = stringSalesSnap.docs;
  const numericDni = Number(dni);
  if (!salesDocs.length && Number.isSafeInteger(numericDni) && String(numericDni) === dni) {
    const numericSalesSnap = await base.collection('ventas')
      .where('dniCliente', '==', numericDni)
      .limit(SALES_LOOKUP_LIMIT)
      .get();
    salesDocs = numericSalesSnap.docs;
  }
  const ventas = salesDocs.map(doc => ({id: doc.id, ...doc.data(), dniCliente: dni}))
    .sort((a, b) => new Date(b.fecha || 0) - new Date(a.fecha || 0));
  const imeis = Array.from(new Set(ventas.map(sale => cleanImei(sale.imeiEquipo)).filter(Boolean)));
  const equipmentSnaps = await Promise.all(imeis.map(imei => base.collection('equipos').doc(imei).get()));
  const equipos = equipmentSnaps.filter(snap => snap.exists).map(snap => ({idEquipo: snap.id, ...snap.data()}));
  const firstSale = ventas[0] || {};
  const clientData = clientSnap.exists ? clientSnap.data() : null;
  const cliente = clientData || ventas.length ? {
    dni,
    nombre: cleanText(clientData?.nombre || firstSale.nombreCliente || dni, 180),
    celular: cleanText(clientData?.celular || firstSale.celularCliente, 30),
    tipoDocumento: cleanText(clientData?.tipoDocumento || firstSale.tipoDocumentoCliente || 'DNI', 30),
  } : null;
  if (ventas.length) return {cliente, ventas, equipos};

  const operationalResult = await lookupOperationalSales(dni, options.authorization, options.fetchImpl);
  return operationalResult || {cliente, ventas, equipos};
}

function normalizeConfig(value) {
  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.fromEntries([1, 2, 3, 4]
    .filter(format => source[`formato${format}`])
    .map(format => [`formato${format}`, normalizeEmisor(source[`formato${format}`])]));
}

async function getConfig(db) {
  const snap = await baseRef(db).collection('configuracion').doc('boletaExtranjeraEmisores').get();
  return {config: snap.exists ? normalizeConfig(snap.data()) : {}};
}

async function saveConfig(db, payload) {
  const config = normalizeConfig(payload.config);
  if (Object.values(config).some(item => !item.nombre || !item.rut || !item.direccion)) {
    throw Object.assign(new Error('CONFIGURACION_INVALIDA'), {status: 400});
  }
  await baseRef(db).collection('configuracion').doc('boletaExtranjeraEmisores').set({
    ...config,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  }, {merge: true});
  return {config};
}

function duplicateError(imei, boletaId, nBoleta = null) {
  return Object.assign(new Error('BOLETA_EQUIPO_YA_EXISTE'), {
    status: 409,
    payload: {imei, boletaId, nBoleta},
  });
}

async function saveBoleta(db, payload) {
  const parsed = normalizeBoletaPayload(payload);
  const base = baseRef(db);
  const boletasRef = base.collection('boletasExtranjeras');
  const locksRef = base.collection('_boletaEquipoLocks');
  const counterRef = base.collection('configuracion').doc('contadorBoletas');
  const isUpdate = parsed.action === 'update';
  if (isUpdate && !parsed.historialId) throw Object.assign(new Error('BOLETA_ID_REQUERIDO'), {status: 400});
  const boletaRef = isUpdate ? boletasRef.doc(parsed.historialId) : boletasRef.doc(parsed.equipoKeys[0]);

  return db.runTransaction(async transaction => {
    const currentSnap = await transaction.get(boletaRef);
    if (isUpdate && !currentSnap.exists) throw Object.assign(new Error('BOLETA_NOT_FOUND'), {status: 404});
    if (!isUpdate && currentSnap.exists) throw duplicateError(parsed.equipoKeys[0], boletaRef.id, currentSnap.data()?.nBoleta);

    const current = currentSnap.exists ? currentSnap.data() || {} : {};
    const oldKeys = equipmentKeys(current);
    const allLockKeys = Array.from(new Set([...oldKeys, ...parsed.equipoKeys]));
    const lockSnaps = [];
    for (const key of allLockKeys) lockSnaps.push(await transaction.get(locksRef.doc(key)));

    const legacySnapshots = [];
    for (const key of parsed.equipoKeys) {
      legacySnapshots.push(await transaction.get(
        boletasRef.where('boletaEquipoKeys', 'array-contains', key).limit(DUPLICATE_QUERY_LIMIT),
      ));
    }

    for (const lockSnap of lockSnaps) {
      const owner = lockSnap.data()?.boletaId;
      if (lockSnap.exists && owner && owner !== boletaRef.id && parsed.equipoKeys.includes(lockSnap.id)) {
        throw duplicateError(lockSnap.id, owner, lockSnap.data()?.nBoleta || null);
      }
    }
    for (let index = 0; index < legacySnapshots.length; index += 1) {
      const conflicting = legacySnapshots[index].docs.find(doc => doc.id !== boletaRef.id);
      if (conflicting) throw duplicateError(parsed.equipoKeys[index], conflicting.id, conflicting.data()?.nBoleta || null);
    }

    let nBoleta = current.nBoleta || parsed.boletaData.nBoleta;
    let nextNumber = null;
    if (!nBoleta) {
      const counterSnap = await transaction.get(counterRef);
      nextNumber = Math.max(Number(counterSnap.data()?.last || 999) + 1, 1000);
      nBoleta = nextNumber;
    }

    const boletaData = {...parsed.boletaData, nBoleta};
    const data = {
      nBoleta,
      clienteDni: boletaData.cliente.dni,
      clienteNombre: boletaData.cliente.nombre,
      totalPen: parsed.totalPen,
      totalClp: boletaData.totalClp,
      fechaHora: boletaData.fechaHora,
      formato: parsed.formato,
      origen: parsed.origen,
      boletaEquipoKey: parsed.equipoKeys[0],
      boletaEquipoKeys: parsed.equipoKeys,
      boletaData,
      createdAt: current.createdAt || admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    };

    if (nextNumber) transaction.set(counterRef, {last: nextNumber, updatedAt: admin.firestore.FieldValue.serverTimestamp()}, {merge: true});
    for (const key of oldKeys.filter(key => !parsed.equipoKeys.includes(key))) {
      const snap = lockSnaps.find(item => item.id === key);
      if (snap?.data()?.boletaId === boletaRef.id) transaction.delete(locksRef.doc(key));
    }
    for (const key of parsed.equipoKeys) {
      transaction.set(locksRef.doc(key), {boletaId: boletaRef.id, nBoleta, updatedAt: admin.firestore.FieldValue.serverTimestamp()});
    }
    transaction.set(boletaRef, data, {merge: true});

    return {id: boletaRef.id, boleta: safeBoleta(boletaRef.id, {...data, createdAt: current.createdAt, updatedAt: new Date()})};
  });
}

export async function dispatchBoletas(db, body, options = {}) {
  const action = cleanText(body?.action, 30);
  if (action === 'list') return listBoletas(db, body);
  if (action === 'lookupSales') return lookupSales(db, body, options);
  if (action === 'getConfig') return getConfig(db);
  if (action === 'saveConfig') return saveConfig(db, body);
  if (action === 'save' || action === 'update') return saveBoleta(db, body);
  throw Object.assign(new Error('ACTION_INVALIDA'), {status: 400});
}

export const __test = {
  cleanDni,
  cleanImei,
  listBoletas,
  lookupSales,
  lookupOperationalSales,
  mapOperationalLookup,
  equipmentKeys,
  normalizeBoletaPayload,
  normalizeConfig,
  safeBoleta,
  saveBoleta,
};

export const handler = event => handlePost(event, body => dispatchBoletas(getAdminDb(), body, {
  authorization: event.headers?.authorization || event.headers?.Authorization || '',
}), {
  name: 'boletas',
  rateLimit: {max: 90, windowMs: 60_000},
});
