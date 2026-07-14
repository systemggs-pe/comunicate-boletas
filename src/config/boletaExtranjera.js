export const DEFAULT_BOLETA_EXTRANJERA_EMISORES = {
  formato1: {
    nombre: 'ROBERTO IGNACIO\nPIZARRO VILLAROEL',
    rut: '17.673.680 - 1',
    direccion: '18 DE SEPTIEMBRE #257\nLOCAL 68 - COM. SANTA BLANCA',
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
    impuestoPorcentaje: '5',
    notas: 'To ensure we are able to help you as best we can, please include your reference number.',
    terminos: 'All Rights Reserved',
    logoDataUrl: '',
  },
};

export function mergeBoletaExtranjeraEmisores(config = {}) {
  return Object.fromEntries(
    Object.entries(DEFAULT_BOLETA_EXTRANJERA_EMISORES).map(([key, defaults]) => [
      key,
      {
        ...defaults,
        ...(config?.[key] || {}),
      },
    ]),
  );
}

export function getBoletaExtranjeraEmisor(config, formato) {
  const merged = mergeBoletaExtranjeraEmisores(config);
  return merged[`formato${formato}`] || merged.formato1;
}
