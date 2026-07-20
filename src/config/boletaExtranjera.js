export const DEFAULT_BOLETA_EXTRANJERA_EMISORES = {
  formato1: {
    nombre: 'ROBERTO IGNACIO\nPIZARRO VILLAROEL',
    rut: '17.673.680 - 1',
    direccion: '18 DE SEPTIEMBRE #257\nLOCAL 68 - COM. SANTA BLANCA',
    giro1: 'Venta de celulares, accesorios y equipos electrónicos',
    giro2: '',
    comuna: 'Arica',
    ciudad: 'Arica',
  },
  formato2: {
    nombre: 'ALVARO JOSE PIZARRO VILLARROEL',
    rut: '18.478.314-2',
    direccion: '18 DE SEPTIEMBRE 257\nArica',
  },
  formato3: {
    nombre: 'ALVARO JOSE PIZARRO VILLARROEL',
    rut: '18.478.314-2',
    direccion: '18 DE SEPTIEMBRE 257',
  },
  formato4: {
    nombre: 'NORTHLINE RETAIL INC.',
    rut: 'SIMULADO',
    direccion: '702 Market Avenue',
    ciudad: 'Orlando, FL 32801',
    pais: 'United States',
    email: 'support@northlineretail.example',
    telefono: '+1 (407) 555-0184',
    sitioWeb: 'www.northlineretail.example/contact',
    metodoPago: 'Tarjeta',
    tipoCambioPenUsd: '3.75',
    impuestoPorcentaje: '5',
    notas: 'To ensure we are able to help you as best we can, please include your reference number.',
    terminos: 'All Rights Reserved',
    logoDataUrl: '',
  },
  formato5: {
    nombre: 'mobileusa',
    rut: 'SIMULADO',
    direccion: '9990 NW 14th St, Ste 110',
    ciudad: 'Doral, Florida 33192-2702',
    pais: 'United States',
    vendedor: 'coloradoforsale',
    metodoPago: 'Debit Card',
    tipoCambioPenUsd: '3.75',
    impuestoPorcentaje: '5',
    notas: "*We're required by law to collect sales tax and applicable fees for certain tax authorities.",
    logoDataUrl: '',
  },
  formato6: {
    nombre: 'Apple Columbia',
    rut: 'SIMULADO',
    direccion: '10300 Little Patuxent Parkway, Space 2040',
    ciudad: 'Columbia, MD 21044',
    pais: 'United States',
    email: 'columbia@apple.com',
    telefono: '410-423-1801',
    sitioWeb: 'www.apple.com/retail/columbia/',
    metodoPago: 'DEBIT (Contactless)',
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
    policyUrl: 'https://www.apple.com/legal/sales-support/sales-policies/retail_us.html',
    supportMessage: 'Learn how to set up your product and transfer your data from home at support.apple.com.',
    logoDataUrl: '',
  },
};

const LOGOS_STORAGE_KEY = 'comunicate:boleta-emisores-logos:v1';

function leerLogosLocales() {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const parsed = JSON.parse(window.localStorage.getItem(LOGOS_STORAGE_KEY) || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function guardarBoletaExtranjeraLogoLocal(formato, logoDataUrl) {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    const logos = leerLogosLocales();
    logos[`formato${Number(formato)}`] = String(logoDataUrl || '');
    window.localStorage.setItem(LOGOS_STORAGE_KEY, JSON.stringify(logos));
  } catch {
    // Firestore sigue siendo la fuente principal si el navegador bloquea localStorage.
  }
}

export function mergeBoletaExtranjeraEmisores(config = {}) {
  const logosLocales = leerLogosLocales();
  return Object.fromEntries(
    Object.entries(DEFAULT_BOLETA_EXTRANJERA_EMISORES).map(([key, defaults]) => [
      key,
      {
        ...defaults,
        ...(config?.[key] || {}),
        logoDataUrl: config?.[key]?.logoDataUrl
          || (Object.hasOwn(logosLocales, key) ? logosLocales[key] : '')
          || defaults.logoDataUrl
          || '',
      },
    ]),
  );
}

export function getBoletaExtranjeraEmisor(config, formato) {
  const merged = mergeBoletaExtranjeraEmisores(config);
  return merged[`formato${formato}`] || merged.formato1;
}

export function getBoletaExtranjeraEmisorParaImpresion(config, formato, origen = {}) {
  const configurado = getBoletaExtranjeraEmisor(config, formato);
  const mismoFormato = Number(origen.formato) === Number(formato);
  if (!mismoFormato) return configurado;

  const guardado = origen.emisor && typeof origen.emisor === 'object' ? origen.emisor : {};
  return {
    ...configurado,
    ...guardado,
    logoDataUrl: guardado.logoDataUrl || configurado.logoDataUrl || '',
  };
}
