import test from 'node:test';
import assert from 'node:assert/strict';
import {__test, lookupPublicBoleta} from '../functions/publicBoleta.mjs';

function makeDoc(id, data) {
  return {
    id,
    data: () => data,
  };
}

function makeDb(docs = []) {
  const calls = [];
  const db = {
    calls,
    collection(name) {
      calls.push(['collection', name]);
      return this;
    },
    doc(id) {
      calls.push(['doc', id]);
      return this;
    },
    where(field, op, value) {
      calls.push(['where', field, op, value]);
      this.whereValue = value;
      return this;
    },
    limit(value) {
      calls.push(['limit', value]);
      this.limitValue = value;
      return this;
    },
    async get() {
      calls.push(['get']);
      return {
        docs: docs
          .filter(doc => doc.data().nBoleta === this.whereValue)
          .slice(0, this.limitValue || docs.length),
      };
    },
  };
  return db;
}

test('lookupPublicBoleta queries by boleta number with a small limit', async () => {
  const db = makeDb([
    makeDoc('imei-1', {
      nBoleta: 1004,
      clienteDni: '12.345.678-9',
      clienteNombre: 'Cliente Demo',
      totalClp: 350000,
      totalPen: 1000,
      fechaHora: '2025-06-16T10:00:00.000-05:00',
      formato: 2,
      boletaData: {
        cliente: {nombre: 'Cliente Demo', dni: '12345678-9'},
        ventas: [{imeiEquipo: '123456789012345', precio: '1000'}],
        equiposMap: {},
        totalClp: 350000,
        fechaHora: '2025-06-16T10:00:00.000-05:00',
        nBoleta: 1004,
        emisor: {},
      },
    }),
  ]);

  const result = await lookupPublicBoleta(db, {
    rut: '12345678-9',
    nBoleta: '1004',
    fecha: '2025-06-16',
    monto: '350.000',
  });

  assert.equal(result.boleta.nBoleta, 1004);
  assert.equal(result.boleta.formato, 2);
  assert.deepEqual(db.calls.filter(call => call[0] === 'where')[0], ['where', 'nBoleta', '==', 1004]);
  assert.deepEqual(db.calls.filter(call => call[0] === 'limit')[0], ['limit', __test.LOOKUP_LIMIT]);
});

test('lookupPublicBoleta rejects when amount does not match', async () => {
  const db = makeDb([
    makeDoc('imei-1', {
      nBoleta: 1004,
      clienteDni: '12345678-9',
      totalClp: 350000,
      fechaHora: '2025-06-16',
      boletaData: {
        cliente: {nombre: 'Cliente Demo', dni: '12345678-9'},
        totalClp: 350000,
        fechaHora: '2025-06-16',
        nBoleta: 1004,
      },
    }),
  ]);

  await assert.rejects(
    () => lookupPublicBoleta(db, {
      rut: '12345678-9',
      nBoleta: '1004',
      fecha: '2025-06-16',
      monto: '350001',
    }),
    error => error.status === 404 && error.message === 'BOLETA_NO_ENCONTRADA',
  );
});

test('lookupPublicBoleta accepts the USD total printed by format 4', async () => {
  const db = makeDb([
    makeDoc('imei-usd', {
      nBoleta: 1005,
      clienteDni: '12345678-9',
      totalClp: 265000,
      totalPen: 1000,
      fechaHora: '2025-06-16',
      formato: 4,
      boletaData: {
        cliente: {nombre: 'Cliente Demo', dni: '12345678-9'},
        totalClp: 265000,
        fechaHora: '2025-06-16',
        nBoleta: 1005,
        emisor: {impuestoPorcentaje: '5', tipoCambioPenUsd: '3.75'},
      },
    }),
  ]);

  const result = await lookupPublicBoleta(db, {
    rut: '12345678-9',
    nBoleta: '1005',
    fecha: '2025-06-16',
    monto: '266.67',
  });

  assert.equal(result.boleta.formato, 4);
  assert.equal(result.boleta.totalUsd, 266.67);
  assert.equal(result.boleta.boletaData.totalUsd, 266.67);
});

test('lookupPublicBoleta accepts the USD total printed by format 5', async () => {
  const db = makeDb([
    makeDoc('imei-usd-5', {
      nBoleta: 1006,
      clienteDni: '12345678-9',
      totalClp: 265000,
      totalPen: 1000,
      fechaHora: '2025-06-16',
      formato: 5,
      boletaData: {
        cliente: {nombre: 'Cliente Demo', dni: '12345678-9'},
        totalClp: 265000,
        fechaHora: '2025-06-16',
        nBoleta: 1006,
        emisor: {impuestoPorcentaje: '5', tipoCambioPenUsd: '3.75'},
      },
    }),
  ]);

  const result = await lookupPublicBoleta(db, {
    rut: '12345678-9',
    nBoleta: '1006',
    fecha: '2025-06-16',
    monto: '266.67',
  });

  assert.equal(result.boleta.formato, 5);
  assert.equal(result.boleta.totalUsd, 266.67);
});

test('lookupPublicBoleta accepts the USD total printed by format 6', async () => {
  const db = makeDb([
    makeDoc('imei-usd-6', {
      nBoleta: 1007,
      clienteDni: '12345678-9',
      totalClp: 265000,
      totalPen: 1000,
      fechaHora: '2025-06-16',
      formato: 6,
      boletaData: {
        cliente: {nombre: 'Cliente Demo', dni: '12345678-9'},
        totalClp: 265000,
        fechaHora: '2025-06-16',
        nBoleta: 1007,
        emisor: {impuestoPorcentaje: '6', tipoCambioPenUsd: '3.75'},
      },
    }),
  ]);

  const result = await lookupPublicBoleta(db, {
    rut: '12345678-9',
    nBoleta: '1007',
    fecha: '2025-06-16',
    monto: '266.67',
  });

  assert.equal(result.boleta.formato, 6);
  assert.equal(result.boleta.totalUsd, 266.67);
});
