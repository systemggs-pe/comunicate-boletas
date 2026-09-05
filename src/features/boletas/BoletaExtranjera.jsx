import React, { useCallback, useState, useEffect, useRef } from 'react';
import {Search, Edit, Printer, ScanBarcode, FileText} from '../../components/Icons.jsx';
import {buscarBoletasHistorial, buscarVentasBoleta, consultarReniecDni, guardarBoletaExtranjera, listarBoletas} from '../../services/functionsClient.js';
import { luhn } from '../../utils/imei.js';
import {penToClp, penToUsd, formatClp, formatUsd} from '../../utils/currency.js';
import { toLocalDatetimeValueBoleta } from '../../utils/dates.js';
import {getBoletaExtranjeraEmisorParaImpresion} from '../../config/boletaExtranjera.js';
import { EscanerIA } from '../registros/EscanerIA.jsx';
import {AccessibleDialog} from '../../components/AccessibleDialog.jsx';
const limpiarParaFirestore = data => JSON.parse(JSON.stringify(data));
const emptyForm = { nombre: '', tipoDocumento: 'DNI', rut: '', imei1: '', imei2: '', sn: '', marca: '', modelo: '', nombreComercial: '', memoria: '', color: '', precio: '' };
const MODOS = [
  {id: 'buscar', label: 'Desde venta'},
  {id: 'nueva', label: 'Registro manual'},
  {id: 'historial', label: 'Historial'},
];
const FORMATOS_BOLETA = {
  1: {label: 'Térmica SII 80 mm', description: 'Ticket fiscal de 80 mm con PDF417'},
  2: {label: 'Térmica 80 mm', description: 'Impresora de 80 mm con PDF417'},
  3: {label: 'Pizarro #3', description: 'Formato Pizarro #3 con PDF417'},
  4: {label: 'Página completa', description: 'Documento de página completa con logo'},
  5: {label: 'Marketplace A4', description: 'Boleta A4 con pedido, envío y artículos'},
  6: {label: 'Apple Store', description: 'Recibo Letter estilo Apple Store'},
  7: {label: 'Thermer', description: 'Ticket angosto como la referencia con código de barras'},
};
const TIPOS_DOCUMENTO = ['DNI', 'Carné de Extranjería', 'Pasaporte', 'RUC', 'Otro'];
const HISTORY_SEARCH_OPTIONS = {
  documento: {label: 'Documento', placeholder: 'DNI, CE, pasaporte o RUC'},
  imei: {label: 'IMEI', placeholder: '15 dígitos del IMEI'},
  boleta: {label: 'N.º de boleta', placeholder: 'Ej. 41903'},
};
const historyDateFormatter = new Intl.DateTimeFormat('es-PE', {dateStyle: 'short', timeStyle: 'short'});

const normalizarDocumentoBoleta = value => String(value || '').trim().toUpperCase()
  .replace(/[.\s]/g, '')
  .replace(/[^A-Z0-9-]/g, '')
  .slice(0, 20);

const getModoFromUrl = () => {
  const mode = new URLSearchParams(window.location.search).get('mode');
  return MODOS.some(item => item.id === mode) ? mode : 'buscar';
};

const writeModoToUrl = (mode, replace = false) => {
  const url = new URL(window.location.href);
  url.searchParams.set('section', 'boletas');
  url.searchParams.set('mode', mode);
  window.history[replace ? 'replaceState' : 'pushState']({}, '', url);
};

const normalizarImeiBoleta = value => {
  const imei = String(value || '').replace(/\D/g, '').slice(0, 15);
  return /^\d{15}$/.test(imei) ? imei : '';
};

const obtenerImeisBoletaData = boletaData => {
  const ventas = Array.isArray(boletaData?.ventas) ? boletaData.ventas : [];
  const keysFromVentas = new Set();
  ventas.forEach(venta => {
    const imei1 = normalizarImeiBoleta(venta?.imeiEquipo);
    const imei2 = normalizarImeiBoleta(venta?.imei2Equipo);
    if (imei1) keysFromVentas.add(imei1);
    if (imei2) keysFromVentas.add(imei2);

    const equipo = imei1 ? boletaData?.equiposMap?.[imei1] : null;
    const imei2Equipo = normalizarImeiBoleta(equipo?.imei2);
    if (imei2Equipo) keysFromVentas.add(imei2Equipo);
  });

  if (keysFromVentas.size) return Array.from(keysFromVentas);

  const keysFromMap = new Set();
  if (boletaData?.equiposMap && typeof boletaData.equiposMap === 'object' && !Array.isArray(boletaData.equiposMap)) {
    Object.entries(boletaData.equiposMap).forEach(([key, equipo]) => {
      const imei1 = normalizarImeiBoleta(key);
      const imei2 = normalizarImeiBoleta(equipo?.imei2);
      if (imei1) keysFromMap.add(imei1);
      if (imei2) keysFromMap.add(imei2);
    });
  }
  return Array.from(keysFromMap);
};

const obtenerImeisBoletaGuardada = boleta => {
  const dataKeys = obtenerImeisBoletaData(boleta?.boletaData);
  if (dataKeys.length) return dataKeys;

  const stored = Array.isArray(boleta?.boletaEquipoKeys)
    ? boleta.boletaEquipoKeys.map(normalizarImeiBoleta).filter(Boolean)
    : [];
  return Array.from(new Set([
    ...stored,
    normalizarImeiBoleta(boleta?.boletaEquipoKey),
  ].filter(Boolean)));
};

const resumirImeisBoleta = boleta => {
  const imeis = obtenerImeisBoletaGuardada(boleta);
  if (imeis.length <= 2) return imeis.join(' / ');
  return `${imeis.slice(0, 2).join(' / ')} / +${imeis.length - 2}`;
};

const crearEquiposMapDesdeVentas = (ventasSeleccionadas, equipos) => {
  const equiposPorImei = new Map(equipos.map(equipo => [equipo.idEquipo, equipo]));
  return ventasSeleccionadas.reduce((map, venta) => {
    const imei = normalizarImeiBoleta(venta?.imeiEquipo);
    if (!imei) return map;

    const equipo = equiposPorImei.get(imei) || {};
    map[imei] = {
      ...equipo,
      imei2: equipo.imei2 || venta.imei2Equipo || '',
      sn: equipo.sn || venta.sn || '',
      marca: equipo.marca || venta.marcaEquipo || '',
      modelo: equipo.modelo || venta.modeloEquipo || '',
      nombreComercial: equipo.nombreComercial || venta.nombreComercial || '',
      memoria: equipo.memoria || venta.memoria || '',
      color: equipo.color || venta.color || '',
    };
    return map;
  }, {});
};

const normalizarTextoBoleta = value => String(value || '').trim().replace(/\s+/g, ' ');

const formatearMemoriaBoleta = value => {
  const memoria = normalizarTextoBoleta(value).toUpperCase();
  if (!memoria) return '';
  return /\b(GB|TB|MB)\b/.test(memoria) ? memoria : `${memoria}GB`;
};

const nombreEquipoBoleta = (venta, data) => {
  const imei = normalizarImeiBoleta(venta?.imeiEquipo);
  const equipo = imei ? data?.equiposMap?.[imei] || {} : {};
  const marca = venta?.marcaEquipo || equipo.marca || '';
  const nombre = equipo.nombreComercial || venta?.nombreComercial || venta?.modeloEquipo || equipo.modelo || '';
  const memoria = formatearMemoriaBoleta(venta?.memoria || equipo.memoria);
  return normalizarTextoBoleta([marca, nombre, memoria].filter(Boolean).join(' '));
};

const obtenerResumenEquipoBoleta = boleta => {
  const data = boleta?.boletaData || {};
  const ventas = Array.isArray(data.ventas) ? data.ventas : [];
  const nombres = ventas.map(venta => nombreEquipoBoleta(venta, data)).filter(Boolean);

  if (!nombres.length && data.equiposMap && typeof data.equiposMap === 'object' && !Array.isArray(data.equiposMap)) {
    Object.entries(data.equiposMap).forEach(([imei, equipo]) => {
      const nombre = normalizarTextoBoleta([
        equipo?.marca,
        equipo?.nombreComercial || equipo?.modelo,
        formatearMemoriaBoleta(equipo?.memoria),
      ].filter(Boolean).join(' '));
      if (nombre || normalizarImeiBoleta(imei)) nombres.push(nombre || `IMEI ${normalizarImeiBoleta(imei)}`);
    });
  }

  const unicos = Array.from(new Set(nombres));
  if (unicos.length <= 1) return unicos[0] || '';
  return `${unicos[0]} +${unicos.length - 1} equipos`;
};

const crearBoletaDataDesdeForm = (form, fechaHora, totalClp) => ({
  cliente: { nombre: form.nombre, dni: form.rut, tipoDocumento: form.tipoDocumento },
  ventas: [{
    imeiEquipo: form.imei1,
    imei2Equipo: form.imei2,
    sn: form.sn,
    marcaEquipo: form.marca,
    nombreComercial: form.nombreComercial,
    modeloEquipo: form.modelo,
    precio: form.precio,
    color: form.color,
    memoria: form.memoria,
  }],
  equiposMap: {
    [form.imei1]: {
      imei2: form.imei2,
      sn: form.sn,
      marca: form.marca,
      modelo: form.modelo,
      color: form.color,
      memoria: form.memoria,
      nombreComercial: form.nombreComercial,
    },
  },
  totalClp,
  fechaHora,
});

const formDesdeBoleta = boleta => {
  const data = boleta?.boletaData || {};
  const venta = Array.isArray(data.ventas) ? data.ventas[0] || {} : {};
  const imei1 = normalizarImeiBoleta(venta.imeiEquipo) || obtenerImeisBoletaGuardada(boleta)[0] || '';
  const equipo = data.equiposMap?.[imei1] || {};
  return {
    nombre: data.cliente?.nombre || boleta?.clienteNombre || '',
    tipoDocumento: data.cliente?.tipoDocumento || boleta?.clienteTipoDocumento || 'DNI',
    rut: data.cliente?.dni || boleta?.clienteDni || '',
    imei1,
    imei2: normalizarImeiBoleta(equipo.imei2 || venta.imei2Equipo),
    sn: equipo.sn || venta.sn || '',
    marca: venta.marcaEquipo || equipo.marca || '',
    modelo: venta.modeloEquipo || equipo.modelo || '',
    nombreComercial: venta.nombreComercial || equipo.nombreComercial || '',
    memoria: venta.memoria || equipo.memoria || '',
    color: venta.color || equipo.color || '',
    precio: String(venta.precio || boleta?.totalPen || ''),
  };
};

export function BoletaExtranjera({boletaEmisoresConfig, showToast}) {
  const [modo, setModo] = useState(getModoFromUrl);
  const [fechaHora, setFechaHora] = useState(toLocalDatetimeValueBoleta(new Date()));
  const [modalBoleta, setModalBoleta] = useState(null);
  const [boletaExistentePrompt, setBoletaExistentePrompt] = useState(null);
  const [boletaEnEdicion, setBoletaEnEdicion] = useState(null);
  const [historialBoletas, setHistorialBoletas] = useState([]);
  const [cargandoHistorial, setCargandoHistorial] = useState(true);
  const [cargandoMas, setCargandoMas] = useState(false);
  const [cursorHistorial, setCursorHistorial] = useState('');
  const [hayMasHistorial, setHayMasHistorial] = useState(false);
  const [historySearchType, setHistorySearchType] = useState('documento');
  const [historySearchQuery, setHistorySearchQuery] = useState('');
  const [historySearchResults, setHistorySearchResults] = useState(null);
  const [historySearchError, setHistorySearchError] = useState('');
  const [buscandoHistorial, setBuscandoHistorial] = useState(false);
  const [imprimiendoBoleta, setImprimiendoBoleta] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState('');
  const imprimiendoBoletaRef = useRef(false);

  const cargarHistorial = useCallback(async (cursor = '', append = false) => {
    append ? setCargandoMas(true) : setCargandoHistorial(true);
    try {
      const result = await listarBoletas(cursor);
      setHistorialBoletas(current => append ? [...current, ...(result.boletas || [])] : (result.boletas || []));
      setCursorHistorial(result.nextCursor || '');
      setHayMasHistorial(Boolean(result.hasMore));
    } catch (error) {
      console.error('Error historial boletas:', error);
      showToast('No se pudo cargar historial de boletas', 'error');
    } finally {
      setCargandoHistorial(false);
      setCargandoMas(false);
    }
  }, [showToast]);

  const buscarHistorial = async event => {
    event.preventDefault();
    const rawQuery = historySearchQuery.trim();
    let query = rawQuery;
    let error = '';
    if (historySearchType === 'documento') {
      query = normalizarDocumentoBoleta(rawQuery);
      if (query.length < 3) error = 'Ingresa un documento válido.';
    } else if (historySearchType === 'imei') {
      query = rawQuery.replace(/\D/g, '').slice(0, 15);
      if (!/^\d{15}$/.test(query)) error = 'El IMEI debe tener 15 dígitos.';
    } else {
      query = rawQuery.replace(/\D/g, '');
      if (!query || Number(query) <= 0) error = 'Ingresa un número de boleta válido.';
    }

    if (error) {
      setHistorySearchError(error);
      document.getElementById('history-search-query')?.focus();
      return;
    }

    setBuscandoHistorial(true);
    setHistorySearchError('');
    setExpandedHistoryId('');
    try {
      const result = await buscarBoletasHistorial(historySearchType, query);
      setHistorySearchResults(Array.isArray(result.boletas) ? result.boletas : []);
    } catch (requestError) {
      console.error('Error al buscar historial:', requestError);
      setHistorySearchError('No se pudo buscar en el historial. Verifica tu conexión e inténtalo nuevamente.');
    } finally {
      setBuscandoHistorial(false);
    }
  };

  const limpiarBusquedaHistorial = () => {
    setHistorySearchQuery('');
    setHistorySearchResults(null);
    setHistorySearchError('');
    setExpandedHistoryId('');
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    cargarHistorial();
  }, [cargarHistorial]);

  useEffect(() => {
    const onPopState = () => setModo(getModoFromUrl());
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  const cambiarModo = (nextMode, focus = false) => {
    setModo(nextMode);
    writeModoToUrl(nextMode);
    if (focus) window.requestAnimationFrame(() => document.getElementById(`boleta-tab-${nextMode}`)?.focus());
  };

  const onTabKeyDown = (event, currentMode) => {
    const currentIndex = MODOS.findIndex(item => item.id === currentMode);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % MODOS.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + MODOS.length) % MODOS.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = MODOS.length - 1;
    else return;
    event.preventDefault();
    cambiarModo(MODOS[nextIndex].id, true);
  };

  // Modo buscar
  const [searchDocumento, setSearchDocumento] = useState('');
  const [clienteEncontrado, setClienteEncontrado] = useState(null);
  const [ventasCliente, setVentasCliente] = useState([]);
  const [equipos, setEquipos] = useState([]);
  const [seleccionadas, setSeleccionadas] = useState(new Set());
  const [buscandoVentas, setBuscandoVentas] = useState(false);
  const [searchError, setSearchError] = useState('');

  const buscar = async () => {
    const documento = normalizarDocumentoBoleta(searchDocumento);
    if (documento.length < 3) {
      setSearchError('Ingresa el documento del cliente.');
      document.getElementById('search-documento')?.focus();
      return;
    }

    setSearchError('');
    setBuscandoVentas(true);
    setClienteEncontrado(null);
    setVentasCliente([]);
    setEquipos([]);
    setSeleccionadas(new Set());
    try {
      const result = await buscarVentasBoleta(documento);
      const vs = Array.isArray(result.ventas) ? result.ventas : [];
      const cliente = result.cliente;
      if (!cliente && vs.length === 0) { setSearchError('No encontramos un cliente o una venta con ese documento.'); return; }

      if (vs.length === 0) showToast('Cliente encontrado, pero no tiene ventas registradas', 'error');

      setClienteEncontrado(cliente);
      setVentasCliente(vs);
      setEquipos(Array.isArray(result.equipos) ? result.equipos : []);
      setSeleccionadas(new Set(vs.map(v => v.id)));
    } catch (error) {
      console.error(error);
      setSearchError('No se pudieron consultar las ventas. Verifica tu conexión e inténtalo nuevamente.');
      showToast('No se pudo buscar las ventas del cliente', 'error');
    } finally {
      setBuscandoVentas(false);
    }
  };

  const toggleVenta = (id) => {
    setSeleccionadas(prev => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  const ventasSel = ventasCliente.filter(v => seleccionadas.has(v.id));
  const totalPen  = ventasSel.reduce((s, v) => s + parseFloat(v.precio || 0), 0);
  const totalClp  = penToClp(totalPen);

  const fechaDesdeVentas = (ventasSeleccionadas) => {
    const fechas = ventasSeleccionadas
      .map(venta => new Date(venta.fecha || 0))
      .filter(date => !Number.isNaN(date.getTime()))
      .sort((a, b) => b - a);
    if (!fechas.length) return fechaHora;
    const fecha = new Date(fechas[0]);
    fecha.setDate(fecha.getDate() - 1);
    return toLocalDatetimeValueBoleta(fecha);
  };

  const buscarBoletaExistente = (boletaData, excludeId = '') => {
    const imeis = new Set(obtenerImeisBoletaData(boletaData));
    if (!imeis.size) return null;

    return historialBoletas.find(boleta => {
      if (excludeId && boleta.id === excludeId) return false;
      return obtenerImeisBoletaGuardada(boleta).some(imei => imeis.has(imei));
    }) || null;
  };

  const abrirSelectorFormato = (boletaData, opciones = {}) => {
    setModalBoleta({
      ...boletaData,
      historialId: opciones.historialId || null,
      guardarHistorial: opciones.guardarHistorial !== false,
      editando: Boolean(opciones.editando),
      formatoOrigen: opciones.formatoOrigen ?? boletaData.formatoOrigen ?? null,
    });
  };

  const prepararBoleta = (boletaData, opciones = {}) => {
    const existente = buscarBoletaExistente(boletaData, opciones.historialId || '');
    if (existente) {
      setBoletaExistentePrompt({boleta: existente, draft: boletaData, opciones});
      return;
    }
    abrirSelectorFormato(boletaData, opciones);
  };

  const editarBoletaExistente = boleta => {
    setBoletaExistentePrompt(null);
    setBoletaEnEdicion(boleta);
    setForm(formDesdeBoleta(boleta));
    setFechaHora(toLocalDatetimeValueBoleta(boleta.boletaData?.fechaHora || boleta.fechaHora || new Date()));
    cambiarModo('nueva');
    showToast('Edita los datos y vuelve a imprimir la boleta', 'success');
  };

  const cancelarEdicionBoleta = () => {
    setBoletaEnEdicion(null);
    setForm({...emptyForm});
  };

  const imprimirBoleta = async (data, formato) => {
    if (imprimiendoBoletaRef.current) return;
    imprimiendoBoletaRef.current = true;
    setImprimiendoBoleta(true);

    const emisorGuardado = data.emisor || data.boletaData?.emisor || {};
    const emisorSeleccionado = getBoletaExtranjeraEmisorParaImpresion(boletaEmisoresConfig, formato, {
      formato: data.formatoOrigen,
      emisor: emisorGuardado,
    });
    const totalPenBoleta = (data.ventas || []).reduce((sum, venta) => sum + Number(venta.precio || 0), 0);
    const boletaData = {
      cliente: data.cliente,
      ventas: data.ventas,
      equiposMap: data.equiposMap,
      totalClp: data.totalClp,
      totalUsd: [4, 5, 6].includes(formato) ? penToUsd(totalPenBoleta, emisorSeleccionado.tipoCambioPenUsd) : 0,
      fechaHora: data.fechaHora,
      nBoleta: data.nBoleta || data.boletaData?.nBoleta || null,
      emisor: emisorSeleccionado,
    };

    try {
      if (data.guardarHistorial) {
        const saved = await guardarBoletaExtranjera({
          action: data.historialId ? 'update' : 'save',
          historialId: data.historialId || '',
          formato,
          boletaData: limpiarParaFirestore(boletaData),
        });
        boletaData.nBoleta = saved.boleta?.nBoleta || boletaData.nBoleta;
        boletaData.emisor = {
          ...boletaData.emisor,
          ...(saved.boleta?.boletaData?.emisor || {}),
          logoDataUrl: boletaData.emisor.logoDataUrl || '',
        };
        if (saved.boleta) {
          setHistorialBoletas(current => [
            saved.boleta,
            ...current.filter(item => item.id !== saved.boleta.id),
          ]);
          setHistorySearchResults(current => current
            ? [saved.boleta, ...current.filter(item => item.id !== saved.boleta.id)]
            : current);
        }
        if (data.historialId) setBoletaEnEdicion(null);
      } else if (!boletaData.nBoleta && data.nBoleta) {
        boletaData.nBoleta = data.nBoleta;
      }

      setModalBoleta(null);
      const pdfModule = await import('./boletaPdf.js');
      if (formato === 1) await pdfModule.generarBoletaExtranjera(boletaData);
      else if (formato === 2) await pdfModule.generarBoletaExtranjera2(boletaData);
      else if (formato === 3) await pdfModule.generarBoletaExtranjera3(boletaData);
      else if (formato === 4) await pdfModule.generarBoletaExtranjera4(boletaData);
      else if (formato === 5) await pdfModule.generarBoletaExtranjera5(boletaData);
      else if (formato === 6) await pdfModule.generarBoletaExtranjera6(boletaData);
      else await pdfModule.generarBoletaExtranjera7(boletaData);
      showToast(data.guardarHistorial ? (data.historialId ? 'Boleta actualizada e impresa' : 'Boleta guardada e impresa') : 'Boleta reimpresa', 'success');
    } catch (error) {
      console.error(error);
      if (error.message === 'BOLETA_EQUIPO_YA_EXISTE') {
        const duplicateId = error.payload?.details?.boletaId || error.payload?.boletaId || '';
        const boleta = historialBoletas.find(item => item.id === duplicateId);
        if (boleta) setBoletaExistentePrompt({boleta, draft: boletaData, opciones: {}});
        showToast('Ese equipo ya tiene una boleta de venta', 'error');
      } else {
        showToast('No se pudo guardar o imprimir la boleta', 'error');
      }
    } finally {
      imprimiendoBoletaRef.current = false;
      setImprimiendoBoleta(false);
    }
  };

  const emitirDesdeVentas = () => {
    if (!clienteEncontrado || ventasSel.length === 0) { showToast('Selecciona al menos una venta', 'error'); return; }
    const equiposMap = crearEquiposMapDesdeVentas(ventasSel, equipos);
    prepararBoleta({ cliente: clienteEncontrado, ventas: ventasSel, equiposMap, totalClp, fechaHora: fechaDesdeVentas(ventasSel) });
  };

  // Modo nueva boleta manual
  const [mostrarEscanerBoleta, setMostrarEscanerBoleta] = useState(false);
  const [escaneoBoletaProcesando, setEscaneoBoletaProcesando] = useState(false);
  const [form, setForm] = useState({...emptyForm});
  const [buscandoReniecBoleta, setBuscandoReniecBoleta] = useState(false);
  const [formErrors, setFormErrors] = useState({});

  const handleFormChange = (e) => {
    const { name, value } = e.target;
    let v = value;
    if (['imei1','imei2'].includes(name)) v = v.replace(/\D/g,'').slice(0,15);
    if (name === 'rut') v = normalizarDocumentoBoleta(v);
    if (['nombre','marca','modelo','nombreComercial','color'].includes(name)) v = v.toUpperCase();
    setForm(prev => ({ ...prev, [name]: v }));
    setFormErrors(current => {
      const next = {...current};
      delete next[name];
      return next;
    });
  };

  useEffect(() => {
    if (form.tipoDocumento !== 'DNI' || !/^\d{8}$/.test(form.rut)) return;

    let activo = true;
    const buscarNombre = async () => {
      setBuscandoReniecBoleta(true);
      try {
        const json = await consultarReniecDni(form.rut);
        if (!activo) return;
        if (json.success && json.result?.full_name) {
          setForm(prev => ({ ...prev, nombre: json.result.full_name.toUpperCase() }));
          showToast('Nombre encontrado por DNI', 'success');
        } else {
          showToast('DNI no encontrado', 'error');
        }
      } catch (e) {
        console.error('RENIEC boleta error:', e);
        const mensaje = e.message === 'RENIEC_TOKEN_MISSING'
          ? 'Falta configurar token RENIEC'
          : e.message === 'BACKEND_NOT_DEPLOYED'
            ? 'Backend no desplegado: abre la app desde el servidor Node'
          : e.message === 'BACKEND_INVALID_RESPONSE'
            ? 'Respuesta inválida de Netlify Functions'
          : e.message === 'BACKEND_NOT_DEPLOYED'
            ? 'Funciones Netlify no desplegadas'
            : 'Error al consultar DNI';
        if (activo) showToast(mensaje, 'error');
      } finally {
        if (activo) setBuscandoReniecBoleta(false);
      }
    };

    buscarNombre();
    return () => { activo = false; };
  }, [form.rut, form.tipoDocumento, showToast]);

  const onEscanerBoleta = (datos) => {
    setMostrarEscanerBoleta(false);
    setEscaneoBoletaProcesando(false);
    setForm(prev => ({
      ...prev,
      imei1:           datos.imei1           || prev.imei1,
      imei2:           datos.imei2           || prev.imei2,
      sn:              datos.sn              || prev.sn,
      marca:           datos.marca           || prev.marca,
      modelo:          datos.modelo          || prev.modelo,
      nombreComercial: datos.nombreComercial || prev.nombreComercial,
      memoria:         datos.memoria         || prev.memoria,
      color:           datos.color           || prev.color,
    }));
    const campos = [datos.marca, datos.nombreComercial, datos.imei1].filter(Boolean).join(' · ');
    showToast(campos || 'Escaneado, revisa los campos', campos ? 'success' : 'error');
  };

  const onEscanerBoletaProcesando = () => {
    setMostrarEscanerBoleta(false);
    setEscaneoBoletaProcesando(true);
  };

  const onEscanerBoletaError = mensaje => {
    setEscaneoBoletaProcesando(false);
    showToast(mensaje || 'No se pudo extraer datos de la caja', 'error');
  };

  const emitirNueva = () => {
    const errors = {};
    if (!form.nombre.trim()) errors.nombre = 'Ingresa el nombre del cliente.';
    if (form.tipoDocumento === 'DNI' && !/^\d{8}$/.test(form.rut)) {
      errors.rut = 'Ingresa un DNI de 8 dígitos.';
    } else if (form.tipoDocumento !== 'DNI' && !/^(?=.*[A-Z0-9])[A-Z0-9-]{6,20}$/.test(form.rut)) {
      errors.rut = 'Ingresa un documento válido de 6 a 20 caracteres.';
    }
    if (!form.imei1) errors.imei1 = 'Ingresa el IMEI principal.';
    else if (!luhn(form.imei1)) errors.imei1 = 'El IMEI 1 no es válido. Verifica los 15 dígitos.';
    if (form.imei2 && !luhn(form.imei2)) errors.imei2 = 'El IMEI 2 no es válido. Verifica los 15 dígitos.';
    if (!form.precio || Number(form.precio) <= 0) errors.precio = 'Ingresa un precio mayor que cero.';
    setFormErrors(errors);
    const firstField = Object.keys(errors)[0];
    if (firstField) {
      window.requestAnimationFrame(() => {
        const input = document.getElementById(`manual-${firstField}`);
        input?.focus();
        input?.scrollIntoView({behavior: 'smooth', block: 'center'});
      });
      return;
    }
    const clpVal = penToClp(form.precio);
    prepararBoleta(crearBoletaDataDesdeForm(form, fechaHora, clpVal), {
      historialId: boletaEnEdicion?.id || '',
      editando: Boolean(boletaEnEdicion),
    });
  };

  const equipoPromptExistente = obtenerResumenEquipoBoleta(boletaExistentePrompt?.boleta);
  const imeisPromptExistente = boletaExistentePrompt ? resumirImeisBoleta(boletaExistentePrompt.boleta) : '';

  const fieldAccessibility = field => ({
    id: `manual-${field}`,
    'aria-invalid': Boolean(formErrors[field]),
    'aria-describedby': formErrors[field] ? `manual-${field}-error` : undefined,
  });

  const fieldError = field => formErrors[field]
    ? <p className="field-error" id={`manual-${field}-error`} role="alert">{formErrors[field]}</p>
    : null;

  const copyImeis = async boleta => {
    const imeis = obtenerImeisBoletaGuardada(boleta).join(' / ');
    if (!imeis) {
      showToast('Esta boleta no tiene IMEI registrado', 'error');
      return;
    }
    try {
      await navigator.clipboard.writeText(imeis);
      showToast('IMEI copiado');
    } catch {
      showToast('No se pudo copiar el IMEI', 'error');
    }
  };

  const totalUsdBoleta = boleta => {
    const explicit = Number(boleta?.totalUsd || boleta?.boletaData?.totalUsd || 0);
    if (explicit > 0) return explicit;
    const totalPenGuardado = Number(boleta?.totalPen || 0) || (boleta?.boletaData?.ventas || [])
      .reduce((sum, venta) => sum + Number(venta.precio || 0), 0);
    const formato = Number(boleta?.formato || 4);
    const rate = boleta?.boletaData?.emisor?.tipoCambioPenUsd
      || boletaEmisoresConfig?.[`formato${formato}`]?.tipoCambioPenUsd;
    return penToUsd(totalPenGuardado, rate);
  };
  const boletasHistorial = historySearchResults ?? historialBoletas;
  const historySearchActive = historySearchResults !== null;

  return (
    <div className="saas-boleta-page space-y-4">
      {/* Selección del tipo de boleta */}
      {modalBoleta && (
        <AccessibleDialog
          title="Elige el formato de impresión"
          description="Selecciona el formato que corresponde a tu impresora."
          onClose={() => !imprimiendoBoleta && setModalBoleta(null)}
          panelClassName="format-dialog"
        >
          <div className="format-options" aria-busy={imprimiendoBoleta}>
            {Object.entries(FORMATOS_BOLETA).map(([format, formatInfo], index) => (
              <button
                key={format}
                type="button"
                disabled={imprimiendoBoleta}
                onClick={() => imprimirBoleta(modalBoleta, Number(format))}
                className="format-option"
                data-dialog-autofocus={index === 0 ? '' : undefined}
              >
                <span>{formatInfo.label}</span>
                <small>{formatInfo.description}</small>
              </button>
            ))}
          </div>
          {imprimiendoBoleta && <p className="dialog-loading" role="status" aria-live="polite">Preparando la BOLETA DE VENTA…</p>}
          <button type="button" disabled={imprimiendoBoleta} onClick={() => setModalBoleta(null)} className="saas-secondary w-full">Cancelar</button>
        </AccessibleDialog>
      )}
      {boletaExistentePrompt && (
        <AccessibleDialog
          title="Este equipo ya tiene una BOLETA DE VENTA"
          description="No puedes generar otra para el mismo IMEI. Revisa o edita la existente."
          onClose={() => setBoletaExistentePrompt(null)}
          panelClassName="duplicate-dialog"
        >
            <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm">
              <p className="font-semibold text-slate-900">{boletaExistentePrompt.boleta.clienteNombre || 'Cliente sin nombre'}</p>
              <p className="mt-1 text-xs text-slate-500">Nro {boletaExistentePrompt.boleta.nBoleta || '-'} / Documento {boletaExistentePrompt.boleta.clienteDni || '-'}</p>
              {equipoPromptExistente && (
                <p className="mt-1 text-sm font-semibold text-slate-800">Equipo: {equipoPromptExistente}</p>
              )}
              <p className="mt-1 font-mono text-xs text-slate-600">IMEI {imeisPromptExistente || '-'}</p>
              <p className="mt-2 text-xs font-semibold text-emerald-700">
                {[4, 5, 6].includes(Number(boletaExistentePrompt.boleta.formato))
                  ? `${formatUsd(totalUsdBoleta(boletaExistentePrompt.boleta))} USD`
                  : `$${formatClp(Number(boletaExistentePrompt.boleta.totalClp || 0))} CLP / S/. ${Number(boletaExistentePrompt.boleta.totalPen || 0).toFixed(2)}`}
              </p>
            </div>
            <div className="mt-5 grid gap-2">
              <button type="button" onClick={() => editarBoletaExistente(boletaExistentePrompt.boleta)} className="saas-primary w-full" data-dialog-autofocus>
                <Edit size={16} /> Editar boleta existente
              </button>
              <button type="button" onClick={() => setBoletaExistentePrompt(null)} className="saas-secondary w-full">
                Cancelar
              </button>
            </div>
        </AccessibleDialog>
      )}
      <div className="boleta-workspace">
        <div className="boleta-utility-row">
          <div className="saas-segmented" role="tablist" aria-label="Flujo de boletas">
            {MODOS.map(item => (
              <button
                key={item.id}
                id={`boleta-tab-${item.id}`}
                type="button"
                role="tab"
                aria-selected={modo === item.id}
                aria-controls={`boleta-panel-${item.id}`}
                tabIndex={modo === item.id ? 0 : -1}
                onClick={() => cambiarModo(item.id)}
                onKeyDown={event => onTabKeyDown(event, item.id)}
                data-active={modo === item.id}
              >{item.label}</button>
            ))}
          </div>
          {modo !== 'historial' && (
            <label className="boleta-date-field" htmlFor="boleta-fecha">Fecha de emisión
              <input id="boleta-fecha" name="fechaHora" type="datetime-local" value={fechaHora} onChange={e => setFechaHora(e.target.value)} autoComplete="off"/>
            </label>
          )}
        </div>

        {/* Modo buscar */}
        {modo === 'buscar' && (
          <section id="boleta-panel-buscar" className="workflow-panel workflow-flow" role="tabpanel" aria-labelledby="boleta-tab-buscar" aria-busy={buscandoVentas}>
            <div className="workflow-heading">
              <span>01</span>
              <div><h2 id="search-sale-title">Buscar una venta</h2><p>Usa el documento registrado: DNI, CE, pasaporte o RUC, para recuperar los equipos.</p></div>
            </div>
            <div className="workflow-search">
              <label className="sr-only" htmlFor="search-documento">Documento del cliente</label>
              <input id="search-documento" name="searchDocumento" value={searchDocumento} onChange={e => { setSearchDocumento(normalizarDocumentoBoleta(e.target.value)); setSearchError(''); }}
                onKeyDown={e => e.key === 'Enter' && buscar()}
                placeholder="DNI, CE, pasaporte o RUC…" autoCapitalize="characters" autoComplete="off" spellCheck="false"
                aria-label="Documento del cliente" aria-invalid={Boolean(searchError)} aria-describedby={searchError ? 'search-documento-error' : undefined}
                className="flex-1 min-w-0" />
              <button type="button" onClick={buscar} disabled={buscandoVentas} className="saas-primary">
                <Search size={16}/> {buscandoVentas ? 'Buscando…' : 'Buscar venta'}
              </button>
            </div>
            {searchError && <p className="field-error" id="search-documento-error" role="alert">{searchError}</p>}
            {buscandoVentas && (
              <p className="ui-status" role="status" aria-live="polite"><span className="ui-spinner" />Consultando ventas del cliente…</p>
            )}

            {clienteEncontrado && (
              <>
                <div className="client-summary text-sm">
                  <p className="font-semibold text-gray-800">{clienteEncontrado.nombre}</p>
                  <p className="text-gray-500 text-xs">{clienteEncontrado.tipoDocumento || 'Documento'}: {clienteEncontrado.dni} · {clienteEncontrado.celular || 'Sin celular'}</p>
                </div>

                {ventasCliente.length === 0 ? (
                  <p className="text-gray-400 text-sm text-center py-4">Este cliente no tiene ventas registradas.</p>
                ) : (
                  <div className="space-y-2">
                    <p className="text-xs font-semibold text-gray-500 uppercase">{ventasCliente.length} {ventasCliente.length === 1 ? 'venta encontrada' : 'ventas encontradas'} · selecciona las que deseas incluir:</p>
                    {ventasCliente.map(v => {
                      const eq = equipos.find(e => e.idEquipo === v.imeiEquipo) || {};
                      const clp = penToClp(v.precio);
                      return (
                        <label key={v.id} className="sale-option" data-selected={seleccionadas.has(v.id)}>
                          <input type="checkbox" checked={seleccionadas.has(v.id)} onChange={() => toggleVenta(v.id)} className="mt-0.5" />
                          <div className="flex-1 text-sm">
                            <p className="font-medium text-gray-800">{v.marcaEquipo} {eq.nombreComercial || v.nombreComercial || v.modeloEquipo}</p>
                            <p className="text-xs text-gray-500 font-mono">IMEI: {v.imeiEquipo}</p>
                            {eq.memoria && <p className="text-xs text-gray-500">{eq.memoria}GB · {eq.color || ''}</p>}
                            <p className="text-xs text-gray-600 mt-1">S/. {parseFloat(v.precio).toFixed(2)} → <span className="font-semibold text-green-700">${formatClp(clp)} CLP</span></p>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}

                {ventasSel.length > 0 && (
                  <div className="sale-summary">
                    <div>
                      <p className="text-xs text-gray-500">Total</p>
                      <p><strong>${formatClp(totalClp)} CLP</strong></p>
                      <p className="text-xs text-gray-400">S/. {totalPen.toFixed(2)} PEN</p>
                    </div>
                    <button type="button" onClick={emitirDesdeVentas} className="saas-primary">
                      <Printer size={16}/> Generar boleta de venta
                    </button>
                  </div>
                )}
              </>
            )}
          </section>
        )}

        {/* Modo nueva boleta */}
        {modo === 'nueva' && (
          <section id="boleta-panel-nueva" className="workflow-panel workflow-flow" role="tabpanel" aria-labelledby="boleta-tab-nueva">
            <div className="workflow-heading">
              <span>02</span>
              <div><h2>Registrar manualmente</h2><p>Completa los datos del cliente y del equipo antes de imprimir.</p></div>
            </div>
            {mostrarEscanerBoleta && (
              <EscanerIA
                onResult={onEscanerBoleta}
                onClose={() => setMostrarEscanerBoleta(false)}
                onProcessingStart={onEscanerBoletaProcesando}
                onError={onEscanerBoletaError}
              />
            )}

            {boletaEnEdicion && (
              <div className="ui-status" data-tone="warning">
                <div>
                  <p className="font-semibold text-amber-900">Editando boleta Nro {boletaEnEdicion.nBoleta || '-'}</p>
                  <p className="mt-1 text-xs font-medium text-amber-800">Los cambios se guardarán sobre esta boleta y luego se imprimirá el nuevo PDF.</p>
                </div>
              </div>
            )}

            {/* Cliente */}
            <p className="form-section-title">Cliente</p>
            <div className="form-grid">
              <div className="ui-field"><label className="ui-field-label" htmlFor="manual-nombre">Nombre *</label><input {...fieldAccessibility('nombre')} name="nombre" value={form.nombre} onChange={handleFormChange} placeholder="Nombre completo…" autoComplete="name" required/>{fieldError('nombre')}</div>
              <div className="ui-field">
                <label className="ui-field-label" htmlFor="manual-tipoDocumento">Tipo de documento *</label>
                <select id="manual-tipoDocumento" name="tipoDocumento" value={form.tipoDocumento} onChange={handleFormChange} required>
                  {TIPOS_DOCUMENTO.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
                </select>
              </div>
              <div className="ui-field wide">
                <label className="ui-field-label" htmlFor="manual-rut">N.º de documento *</label>
                <input {...fieldAccessibility('rut')} name="rut" value={form.rut} onChange={handleFormChange} className="font-mono" autoCapitalize="characters" autoComplete="off" spellCheck="false" required/>
                {fieldError('rut')}
                {buscandoReniecBoleta && <p className="ui-status" role="status" aria-live="polite"><span className="ui-spinner" />Consultando DNI en RENIEC…</p>}
              </div>
            </div>

            {/* Equipo */}
            <div className="form-section-bar">
              <p className="form-section-title">Equipo</p>
              <button type="button" onClick={() => setMostrarEscanerBoleta(true)} className="saas-secondary">
                <ScanBarcode size={13}/> Escanear caja
              </button>
            </div>
            <div className="form-grid">
              {escaneoBoletaProcesando && (
                <div className="ui-status wide" role="status" aria-live="polite">
                  <span className="ui-spinner" />
                  Extrayendo datos de la caja del equipo…
                </div>
              )}
              <div className="ui-field">
                <label className="ui-field-label" htmlFor="manual-imei1">IMEI 1 *</label>
                <input {...fieldAccessibility('imei1')} name="imei1" value={form.imei1} onChange={handleFormChange}
                  className={`font-mono ${form.imei1.length === 15 ? (luhn(form.imei1) ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50') : ''}`} inputMode="numeric" autoComplete="off" spellCheck="false" required/>
                {fieldError('imei1')}
                {form.imei1.length === 15 && (
                  <p className={`text-xs mt-1 font-medium ${luhn(form.imei1) ? 'text-green-600' : 'text-red-600'}`}>
                    {luhn(form.imei1) ? 'IMEI válido' : 'IMEI inválido, verifica los dígitos'}
                  </p>
                )}
              </div>
              <div className="ui-field">
                <label className="ui-field-label" htmlFor="manual-imei2">IMEI 2</label>
                <input {...fieldAccessibility('imei2')} name="imei2" value={form.imei2} onChange={handleFormChange}
                  className={`font-mono ${form.imei2.length === 15 ? (luhn(form.imei2) ? 'border-green-400 bg-green-50' : 'border-red-400 bg-red-50') : ''}`} inputMode="numeric" autoComplete="off" spellCheck="false"/>
                {fieldError('imei2')}
                {form.imei2.length === 15 && (
                  <p className={`text-xs mt-1 font-medium ${luhn(form.imei2) ? 'text-green-600' : 'text-red-600'}`}>
                    {luhn(form.imei2) ? 'IMEI válido' : 'IMEI inválido, verifica los dígitos'}
                  </p>
                )}
              </div>
              <div className="ui-field"><label className="ui-field-label" htmlFor="manual-sn">N.º de serie (S/N)</label><input {...fieldAccessibility('sn')} name="sn" value={form.sn} onChange={handleFormChange} className="font-mono" autoComplete="off" spellCheck="false"/></div>
              <div className="ui-field"><label className="ui-field-label" htmlFor="manual-marca">Marca</label><input {...fieldAccessibility('marca')} name="marca" value={form.marca} onChange={handleFormChange} autoComplete="off"/></div>
              <div className="ui-field"><label className="ui-field-label" htmlFor="manual-nombreComercial">Nombre comercial</label><input {...fieldAccessibility('nombreComercial')} name="nombreComercial" value={form.nombreComercial} onChange={handleFormChange} autoComplete="off"/></div>
              <div className="ui-field"><label className="ui-field-label" htmlFor="manual-modelo">Modelo</label><input {...fieldAccessibility('modelo')} name="modelo" value={form.modelo} onChange={handleFormChange} autoComplete="off"/></div>
              <div className="ui-field"><label className="ui-field-label" htmlFor="manual-memoria">Memoria (GB)</label><input {...fieldAccessibility('memoria')} name="memoria" value={form.memoria} onChange={handleFormChange} inputMode="numeric" autoComplete="off"/></div>
              <div className="ui-field"><label className="ui-field-label" htmlFor="manual-color">Color</label><input {...fieldAccessibility('color')} name="color" value={form.color} onChange={handleFormChange} autoComplete="off"/></div>
            </div>

            {/* Precio */}
            <div className="ui-field">
              <label className="ui-field-label" htmlFor="manual-precio">Precio (S/. PEN) *</label>
              <input {...fieldAccessibility('precio')} name="precio" value={form.precio} onChange={handleFormChange} type="number" min="0.01" step="0.01" inputMode="decimal"
                className="font-bold text-green-700" autoComplete="off" required/>
              {fieldError('precio')}
              {form.precio && <p className="text-xs text-gray-500 mt-1">= <span className="font-semibold text-green-700">${formatClp(penToClp(form.precio))} CLP</span></p>}
            </div>

            <div className="boleta-form-actions">
              <button type="button" onClick={() => { setFormErrors({}); boletaEnEdicion ? cancelarEdicionBoleta() : setForm({...emptyForm}); }} className="saas-secondary">
                {boletaEnEdicion ? 'Cancelar edición' : 'Limpiar'}
              </button>
              <button type="button" onClick={emitirNueva} className="saas-primary flex-1">
                <Printer size={16}/> {boletaEnEdicion ? 'Actualizar e imprimir' : 'Generar BOLETA DE VENTA'}
              </button>
            </div>
          </section>
        )}

        {modo === 'historial' && (
          <section id="boleta-panel-historial" className="workflow-panel workflow-flow" role="tabpanel" aria-labelledby="boleta-tab-historial" aria-busy={cargandoHistorial || cargandoMas || buscandoHistorial}>
            <div className="workflow-heading">
              <span>03</span>
              <div><h2>Historial de boletas de venta</h2><p>Busca por documento, IMEI o número; luego edita o vuelve a imprimir.</p></div>
            </div>
            <form className="history-search" onSubmit={buscarHistorial} noValidate>
              <label htmlFor="history-search-type">Buscar por
                <select
                  id="history-search-type"
                  value={historySearchType}
                  onChange={event => {
                    setHistorySearchType(event.target.value);
                    setHistorySearchQuery('');
                    setHistorySearchResults(null);
                    setHistorySearchError('');
                  }}
                >
                  {Object.entries(HISTORY_SEARCH_OPTIONS).map(([value, option]) => <option key={value} value={value}>{option.label}</option>)}
                </select>
              </label>
              <label className="history-search-value" htmlFor="history-search-query">Dato a buscar
                <input
                  id="history-search-query"
                  value={historySearchQuery}
                  onChange={event => {
                    const value = historySearchType === 'documento'
                      ? normalizarDocumentoBoleta(event.target.value)
                      : event.target.value.replace(/\D/g, '').slice(0, historySearchType === 'imei' ? 15 : 12);
                    setHistorySearchQuery(value);
                    setHistorySearchError('');
                  }}
                  placeholder={HISTORY_SEARCH_OPTIONS[historySearchType].placeholder}
                  inputMode={historySearchType === 'documento' ? 'text' : 'numeric'}
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck="false"
                  aria-invalid={Boolean(historySearchError)}
                  aria-describedby={historySearchError ? 'history-search-error' : undefined}
                />
              </label>
              <button type="submit" className="saas-primary" disabled={buscandoHistorial || cargandoHistorial}><Search size={16}/> {buscandoHistorial ? 'Buscando…' : 'Buscar'}</button>
              {historySearchActive && <button type="button" className="saas-secondary" onClick={limpiarBusquedaHistorial} disabled={buscandoHistorial}>Limpiar</button>}
            </form>
            {historySearchError && <p className="field-error" id="history-search-error" role="alert">{historySearchError}</p>}
            {historySearchActive && !buscandoHistorial && (
              <p className="history-search-status" role="status" aria-live="polite">
                {boletasHistorial.length} {boletasHistorial.length === 1 ? 'boleta encontrada' : 'boletas encontradas'}
              </p>
            )}
            {cargandoHistorial && !historySearchActive ? (
              <div className="saas-empty py-10" role="status" aria-live="polite">
                <p className="text-sm">Cargando historial…</p>
              </div>
            ) : boletasHistorial.length === 0 ? (
              <div className="saas-empty py-10">
                <FileText size={40} strokeWidth={1.4} />
                <p className="text-sm font-semibold">{historySearchActive ? 'No encontramos boletas' : 'Sin boletas de venta guardadas'}</p>
                <p className="text-xs">{historySearchActive ? 'Revisa el dato e intenta nuevamente.' : 'Las boletas de venta aparecerán aquí después de imprimirlas.'}</p>
              </div>
            ) : (
              <div className="ui-list-surface divide-y divide-slate-100">
                {boletasHistorial.map(boleta => {
                  const equipoPreview = obtenerResumenEquipoBoleta(boleta);
                  const imeisPreview = resumirImeisBoleta(boleta);
                  const imeis = obtenerImeisBoletaGuardada(boleta);
                  const expanded = expandedHistoryId === boleta.id;
                  const tipoDocumento = boleta.clienteTipoDocumento || boleta.boletaData?.cliente?.tipoDocumento || 'Documento';
                  return (
                    <div key={boleta.id} className="history-entry ui-list-row flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <p className="history-name text-sm font-semibold text-slate-900">{boleta.clienteNombre || 'Cliente sin nombre'}</p>
                        {equipoPreview && (
                          <p className="history-equipment mt-1 text-sm font-semibold text-slate-800">{equipoPreview}</p>
                        )}
                        <p className="history-meta mt-0.5 text-xs text-slate-500">
                          N.º {boleta.nBoleta || '-'} · {tipoDocumento} {boleta.clienteDni || '-'} · {boleta.fechaHora ? historyDateFormatter.format(new Date(boleta.fechaHora)) : 'Sin fecha'}
                        </p>
                        <p className="mt-1 text-xs font-semibold text-emerald-700">
                          {[4, 5, 6].includes(Number(boleta.formato))
                            ? `${formatUsd(totalUsdBoleta(boleta))} USD`
                            : `$${formatClp(Number(boleta.totalClp || 0))} CLP · S/. ${Number(boleta.totalPen || 0).toFixed(2)}`}
                        </p>
                        <p className="history-imei mt-1 font-mono text-xs text-slate-500">
                          IMEI {imeisPreview || '-'}
                        </p>
                        {expanded && (
                          <div className="history-details" id={`history-details-${boleta.id}`}>
                            <dl>
                              <div><dt>Cliente</dt><dd>{boleta.clienteNombre || 'Sin nombre'}</dd></div>
                              <div><dt>{tipoDocumento}</dt><dd>{boleta.clienteDni || '-'}</dd></div>
                              <div><dt>Equipo</dt><dd>{equipoPreview || 'Sin equipo'}</dd></div>
                              <div><dt>IMEI</dt><dd className="font-mono">{imeis.join(' / ') || '-'}</dd></div>
                            </dl>
                            <button type="button" className="saas-secondary" onClick={() => copyImeis(boleta)}>Copiar IMEI</button>
                          </div>
                        )}
                      </div>
                      <div className="history-actions flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => setExpandedHistoryId(expanded ? '' : boleta.id)}
                          className="saas-secondary"
                          aria-expanded={expanded}
                          aria-controls={`history-details-${boleta.id}`}
                        >
                          {expanded ? 'Ocultar' : 'Detalles'}
                        </button>
                        <button
                          type="button"
                          onClick={() => editarBoletaExistente(boleta)}
                          className="saas-secondary"
                        >
                          <Edit size={15}/> Editar
                        </button>
                        <button
                          type="button"
                          onClick={() => abrirSelectorFormato(
                            {...boleta.boletaData, nBoleta: boleta.nBoleta || boleta.boletaData?.nBoleta},
                            {historialId: boleta.id, guardarHistorial: false, formatoOrigen: boleta.formato},
                          )}
                          className="saas-secondary"
                        >
                          <Printer size={15}/> Reimprimir
                        </button>
                      </div>
                    </div>
                  );
                })}
                {!historySearchActive && hayMasHistorial && (
                  <div className="flex justify-center px-4 py-4">
                    <button type="button" className="saas-secondary" disabled={cargandoMas} onClick={() => cargarHistorial(cursorHistorial, true)}>
                      {cargandoMas ? 'Cargando…' : 'Cargar 50 más'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
}
