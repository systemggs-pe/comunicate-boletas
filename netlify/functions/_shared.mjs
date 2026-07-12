import {randomUUID} from 'node:crypto';

const allowedOrigins = [
  'http://localhost:5174',
  'http://127.0.0.1:5174',
  process.env.URL,
  process.env.DEPLOY_PRIME_URL,
  ...(process.env.ALLOWED_ORIGINS || '').split(',').map(value => value.trim()).filter(Boolean),
].filter(Boolean);

const defaultEmails = ['brand050103@gmail.com', 'lauryruyz50@gmail.com'];
const rateBuckets = new Map();

function allowedEmails() {
  const configured = String(process.env.ALLOWED_EMAILS || '').split(',').map(value => value.trim().toLowerCase()).filter(Boolean);
  return new Set(configured.length ? configured : defaultEmails);
}

function clientIp(event) {
  return String(event.headers?.['x-nf-client-connection-ip'] || event.headers?.['x-forwarded-for'] || 'unknown').split(',')[0].trim();
}

export function enforceRequestRateLimit(key, {max = 60, windowMs = 60_000} = {}) {
  const now = Date.now();
  const current = rateBuckets.get(key);
  if (!current || current.resetAt <= now) {
    rateBuckets.set(key, {count: 1, resetAt: now + windowMs});
    return;
  }
  if (current.count >= max) throw Object.assign(new Error('Demasiadas solicitudes'), {status: 429});
  current.count += 1;
  if (rateBuckets.size > 1000) {
    for (const [bucketKey, bucket] of rateBuckets) if (bucket.resetAt <= now) rateBuckets.delete(bucketKey);
  }
}

export function corsHeaders(event) {
  const origin = event.headers?.origin || event.headers?.Origin || '';
  const headers = {
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Request-Id',
    'Access-Control-Expose-Headers': 'X-Request-Id',
  };
  if (allowedOrigins.includes(origin)) {
    headers['Access-Control-Allow-Origin'] = origin;
    headers.Vary = 'Origin';
  }
  return headers;
}

export function json(statusCode, body, headers = {}) {
  return {statusCode, headers: {'Content-Type': 'application/json; charset=utf-8', ...headers}, body: JSON.stringify(body)};
}

export function parseBody(event) {
  try {
    return event.body ? JSON.parse(event.body) : {};
  } catch {
    throw Object.assign(new Error('JSON_INVALIDO'), {status: 400});
  }
}

export async function requireFirebaseUser(event) {
  const apiKey = process.env.FIREBASE_API_KEY;
  if (!apiKey) throw Object.assign(new Error('FIREBASE_API_KEY_MISSING'), {status: 500});
  const header = event.headers?.authorization || event.headers?.Authorization || '';
  const token = header.match(/^Bearer (.+)$/)?.[1];
  if (!token) throw Object.assign(new Error('No autorizado'), {status: 401});

  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${apiKey}`, {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({idToken: token}),
  });
  const data = await response.json().catch(() => ({}));
  const user = data.users?.[0];
  const email = String(user?.email || '').toLowerCase();
  if (!response.ok || !user?.localId || !user.emailVerified || !allowedEmails().has(email)) {
    throw Object.assign(new Error('No autorizado'), {status: 403});
  }
  return {uid: user.localId, email};
}

export async function handlePost(event, callback, options = {}) {
  const requestId = event.headers?.['x-request-id'] || randomUUID();
  const headers = {...corsHeaders(event), 'X-Request-Id': requestId};
  if (event.httpMethod === 'OPTIONS') return {statusCode: 204, headers, body: ''};
  if (event.httpMethod !== 'POST') return json(405, {error: 'Metodo no permitido', requestId}, headers);

  try {
    const user = await requireFirebaseUser(event);
    enforceRequestRateLimit(`${options.name || 'api'}:${user.uid}`, options.rateLimit);
    const result = await callback(parseBody(event), user, {requestId, ip: clientIp(event)});
    return json(200, result, headers);
  } catch (error) {
    return json(error.status || 500, {
      error: error.message || 'Error interno',
      requestId,
      ...(error.payload ? {details: error.payload} : {}),
    }, headers);
  }
}

export function valueOrEmpty(value) {
  const text = String(value || '').trim();
  if (!text || text.includes('*') || /^data in credit$/i.test(text)) return '';
  return text;
}

export function getClientIp(event) {
  return clientIp(event);
}
