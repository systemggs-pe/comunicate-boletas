import {auth} from '../lib/firebase.js';

const BACKEND_BASE_URL = (import.meta.env.VITE_BACKEND_BASE_URL || '').replace(/\/$/, '');

function looksLikeHtml(text) {
  return /^\s*<!doctype html/i.test(text) || /^\s*<html/i.test(text);
}

async function request(path, payload, authenticated = true, baseUrl = BACKEND_BASE_URL) {
  const headers = {'Content-Type': 'application/json'};
  if (authenticated) {
    const user = auth.currentUser;
    if (!user) throw new Error('SESION_REQUERIDA');
    headers.Authorization = `Bearer ${await user.getIdToken()}`;
  }

  const response = await fetch(`${baseUrl}${path}`, {
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

function mapOperationalSalesLookup(data, dni) {
  const normalizedDni = String(dni || '').replace(/\D/g, '');
  const clientes = Array.isArray(data?.clientes) ? data.clientes : [];
  const source = clientes.find(cliente => String(cliente?.dni || cliente?.id || '').replace(/\D/g, '') === normalizedDni);
  if (!source) return {cliente: null, ventas: [], equipos: []};
  const ventas = Array.isArray(source.ventas) ? source.ventas : [];
  return {
    cliente: {
      dni: normalizedDni,
      nombre: source.nombre || ventas[0]?.nombreCliente || normalizedDni,
      celular: source.celular || ventas[0]?.celularCliente || '',
      tipoDocumento: source.tipoDocumento || ventas[0]?.tipoDocumentoCliente || 'DNI',
    },
    ventas: ventas.map(venta => ({...venta, dniCliente: normalizedDni})),
    equipos: Array.isArray(source.equipos) ? source.equipos : [],
  };
}

export async function buscarVentasBoleta(dni) {
  const result = await request('/api/boletas', {action: 'lookupSales', dni}, true);
  if (Array.isArray(result?.ventas) && result.ventas.length > 0) return result;

  // Durante `npm run dev`, la funcion publicada puede no incluir aun los cambios
  // locales. El proxy de Vite consulta el mismo backend operativo de Ventas sin CORS.
  if (import.meta.env.DEV) {
    const operational = await request('/operational-api/api/clientes', {
      action: 'queryOperational',
      searchTerm: String(dni || '').replace(/\D/g, ''),
      searchField: 'dni',
      limit: 1,
    }, true, '');
    const mapped = mapOperationalSalesLookup(operational, dni);
    if (mapped.ventas.length > 0) return mapped;
  }

  return result;
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
