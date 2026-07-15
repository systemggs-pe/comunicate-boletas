import {randomUUID} from 'node:crypto';
import {corsHeaders, enforceRequestRateLimit, getClientIp, json, parseBody} from './_shared.mjs';
import {getAdminDb} from './_firebaseAdmin.mjs';

const APP_ID = 'comunicate-pos';
const SCOPE = 'shared';
const LOOKUP_LIMIT = 5;
const RATE_LIMIT = {name: 'publicBoleta', max: 12, windowMs: 60 * 1000};

function baseRef(db) {
  return db.collection('artifacts').doc(APP_ID).collection('users').doc(SCOPE);
}

function normalizeRut(value) {
  return String(value || '').replace(/[\s.-]/g, '').toUpperCase();
}

function normalizeBoletaNumber(value) {
  const number = Number(String(value || '').replace(/\D/g, ''));
  return Number.isInteger(number) && number > 0 ? number : null;
}

function normalizeMoney(value) {
  let text = String(value || '').trim();
  if (!text) return null;

  text = text.replace(/[^\d,.-]/g, '');
  const commaIndex = text.lastIndexOf(',');
  const dotIndex = text.lastIndexOf('.');

  if (commaIndex >= 0 && dotIndex >= 0) {
    text = commaIndex > dotIndex
      ? text.replace(/\./g, '').replace(',', '.')
      : text.replace(/,/g, '');
  } else if (commaIndex >= 0) {
    const parts = text.split(',');
    const decimals = parts.at(-1) || '';
    text = decimals.length === 2
      ? `${parts.slice(0, -1).join('')}.${decimals}`
      : text.replace(/,/g, '');
  } else if ((text.match(/\./g) || []).length > 1 || /\.\d{3}$/.test(text)) {
    text = text.replace(/\./g, '');
  }

  const number = Number(text);
  return Number.isFinite(number) && number >= 0 ? number : null;
}

function localDateKey(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';
  const pad = value => String(value).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function dateKeys(value) {
  const text = String(value || '').trim();
  const keys = new Set();
  const direct = text.match(/\d{4}-\d{2}-\d{2}/)?.[0];
  if (direct) keys.add(direct);

  const parsed = new Date(text);
  const localKey = localDateKey(parsed);
  if (localKey) {
    keys.add(localKey);
    keys.add(parsed.toISOString().slice(0, 10));
  }
  return keys;
}

function amountMatches(inputAmount, totals) {
  if (!Number.isFinite(inputAmount)) return false;
  return totals.some(total => {
    const number = normalizeMoney(total);
    if (!Number.isFinite(number)) return false;
    return Math.abs(number - inputAmount) < 0.01 || Math.round(number) === Math.round(inputAmount);
  });
}

function format4UsdTotal(data = {}) {
  const explicit = Number(data.totalUsd || data.boletaData?.totalUsd || 0);
  if (explicit > 0) return Math.round(explicit * 100) / 100;
  const boletaData = data.boletaData || {};
  const totalPen = Number(data.totalPen || 0) || (Array.isArray(boletaData.ventas)
    ? boletaData.ventas.reduce((sum, sale) => sum + Number(sale?.precio || 0), 0)
    : 0);
  const penPerUsd = Number(boletaData.emisor?.tipoCambioPenUsd || 3.75);
  if (!(totalPen > 0) || !(penPerUsd > 0)) return 0;
  return Math.round((totalPen / penPerUsd) * 100) / 100;
}

function parseLookupPayload(payload = {}) {
  const rut = normalizeRut(payload.rut);
  const nBoleta = normalizeBoletaNumber(payload.nBoleta);
  const monto = normalizeMoney(payload.monto);
  const fecha = dateKeys(payload.fecha);

  if (!rut) throw Object.assign(new Error('RUT_REQUERIDO'), {status: 400});
  if (!nBoleta) throw Object.assign(new Error('BOLETA_REQUERIDA'), {status: 400});
  if (!fecha.size) throw Object.assign(new Error('FECHA_REQUERIDA'), {status: 400});
  if (!Number.isFinite(monto)) throw Object.assign(new Error('MONTO_REQUERIDO'), {status: 400});

  return {rut, nBoleta, fecha, monto};
}

function boletaMatchesLookup(data = {}, lookup) {
  const storedRut = normalizeRut(data.clienteDni || data.boletaData?.cliente?.dni);
  if (storedRut !== lookup.rut) return false;

  const storedDates = dateKeys(data.fechaHora || data.boletaData?.fechaHora);
  const sameDate = [...lookup.fecha].some(key => storedDates.has(key));
  if (!sameDate) return false;

  const totals = [
    data.totalClp,
    data.boletaData?.totalClp,
    data.totalPen,
  ];
  if ([4, 5, 6].includes(Number(data.formato || 1))) totals.push(format4UsdTotal(data));
  return amountMatches(lookup.monto, totals);
}

function safeBoleta(doc) {
  const data = doc.data() || {};
  const boletaData = data.boletaData || {};
  const totalUsd = [4, 5, 6].includes(Number(data.formato || 1)) ? format4UsdTotal(data) : 0;

  return {
    id: doc.id,
    nBoleta: data.nBoleta || boletaData.nBoleta || null,
    formato: Number(data.formato || 1),
    fechaHora: data.fechaHora || boletaData.fechaHora || '',
    totalClp: Number(data.totalClp || boletaData.totalClp || 0),
    totalPen: Number(data.totalPen || 0),
    totalUsd,
    clienteNombre: String(data.clienteNombre || boletaData.cliente?.nombre || ''),
    boletaData: {
      cliente: {
        nombre: String(boletaData.cliente?.nombre || data.clienteNombre || ''),
        dni: String(boletaData.cliente?.dni || data.clienteDni || ''),
      },
      ventas: Array.isArray(boletaData.ventas) ? boletaData.ventas : [],
      equiposMap: boletaData.equiposMap && typeof boletaData.equiposMap === 'object'
        ? boletaData.equiposMap
        : {},
      totalClp: Number(boletaData.totalClp || data.totalClp || 0),
      totalUsd,
      fechaHora: boletaData.fechaHora || data.fechaHora || '',
      nBoleta: data.nBoleta || boletaData.nBoleta || null,
      emisor: boletaData.emisor || {},
    },
  };
}

export async function lookupPublicBoleta(db, payload) {
  const lookup = parseLookupPayload(payload);
  const boletasRef = baseRef(db).collection('boletasExtranjeras');
  const snap = await boletasRef.where('nBoleta', '==', lookup.nBoleta).limit(LOOKUP_LIMIT).get();

  const match = snap.docs.find(doc => boletaMatchesLookup(doc.data() || {}, lookup));
  if (!match) {
    throw Object.assign(new Error('BOLETA_NO_ENCONTRADA'), {status: 404});
  }

  return {boleta: safeBoleta(match)};
}

export const __test = {
  LOOKUP_LIMIT,
  amountMatches,
  boletaMatchesLookup,
  dateKeys,
  lookupPublicBoleta,
  normalizeBoletaNumber,
  normalizeMoney,
  normalizeRut,
};

export async function handler(event) {
  const requestId = event.headers?.['x-request-id'] || randomUUID();
  const headers = {
    ...corsHeaders(event),
    'X-Request-Id': requestId,
  };

  if (event.httpMethod === 'OPTIONS') {
    return {statusCode: 204, headers, body: ''};
  }
  if (event.httpMethod !== 'POST') {
    return json(405, {error: 'Metodo no permitido', requestId}, headers);
  }

  try {
    enforceRequestRateLimit(`publicBoleta:${getClientIp(event)}`, RATE_LIMIT);
    const db = getAdminDb();
    const result = await lookupPublicBoleta(db, parseBody(event));
    return json(200, result, headers);
  } catch (error) {
    return json(error.status || 500, {
      error: error.message || 'Error interno',
      requestId,
    }, headers);
  }
}
