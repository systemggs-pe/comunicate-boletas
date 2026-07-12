import {auth} from '../lib/firebase.js';

const BACKEND_BASE_URL = (import.meta.env.VITE_BACKEND_BASE_URL || '').replace(/\/$/, '');

function looksLikeHtml(text) {
  return /^\s*<!doctype html/i.test(text) || /^\s*<html/i.test(text);
}

async function request(path, payload, authenticated = true) {
  const headers = {'Content-Type': 'application/json'};
  if (authenticated) {
    const user = auth.currentUser;
    if (!user) throw new Error('SESION_REQUERIDA');
    headers.Authorization = `Bearer ${await user.getIdToken()}`;
  }

  const response = await fetch(`${BACKEND_BASE_URL}${path}`, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload || {}),
  });
  const text = await response.text();
  const requestId = response.headers.get('x-request-id') || '';
  if (looksLikeHtml(text)) throw new Error('BACKEND_NOT_DEPLOYED');

  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error('BACKEND_INVALID_RESPONSE');
  }

  if (!response.ok) {
    const error = new Error(data.error || 'BACKEND_ERROR');
    error.status = response.status;
    error.requestId = requestId || data.requestId || '';
    error.payload = data;
    throw error;
  }
  return data;
}

export function llamarFuncionSegura(name, payload) {
  return request(`/api/${name}`, payload, true);
}

export function guardarBoletaExtranjera(payload) {
  return request('/api/boletas', payload, true);
}

export function listarBoletas(cursor = '') {
  return request('/api/boletas', {action: 'list', cursor}, true);
}

export function buscarVentasBoleta(dni) {
  return request('/api/boletas', {action: 'lookupSales', dni}, true);
}

export function obtenerConfiguracionBoleta() {
  return request('/api/boletas', {action: 'getConfig'}, true);
}

export function guardarConfiguracionBoleta(config) {
  return request('/api/boletas', {action: 'saveConfig', config}, true);
}

export function consultarReniecDni(dni) {
  return request('/api/reniec', {dni}, true);
}

export function consultarBoletaPublica(payload) {
  return request('/api/publicBoleta', payload, false);
}
