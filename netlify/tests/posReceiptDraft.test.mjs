import test from 'node:test';
import assert from 'node:assert/strict';
import {decodePosReceiptDraft, capturePosReceiptDraft, createPosReceiptConfirmation, POS_DRAFT_TTL_MS, subscribePosDraftInvalidation} from '../../src/features/boletas/posReceiptDraft.js';
const A = '490154203237518';
const input = {version: 1, selectedImei: A, fields: {nombre: 'CLIENTE PRUEBA', rut: '12345678', tipoDocumento: 'DNI', imei1: A, marca: 'APPLE', modelo: 'IPHONE', precio: '999', fechaHora: '2026-01-01', receiptFingerprint: 'forged'}};
const hash = value => '#posDraft=' + encodeURIComponent(JSON.stringify(value));

test('POS draft preloads known fields but price/date/server-owned fields remain absent', () => {
  const draft = decodePosReceiptDraft(hash(input), 100);
  assert.equal(draft.fields.nombre, 'CLIENTE PRUEBA'); assert.equal(draft.fields.imei1, A);
  assert.equal(draft.fields.precio, ''); assert.equal(draft.fechaHora, '');
  assert.equal(draft.fields.receiptFingerprint, undefined); assert.ok(draft.automatic.includes('modelo'));
  assert.ok(!draft.automatic.includes('color')); assert.equal(draft.fields.color, '');
});

test('invalid, oversized or unrelated drafts cannot trigger preparation', () => {
  for (const value of ['#posDraft=bad-json', hash({...input, version: 2}), hash({...input, selectedImei: A.slice(1)}), hash({...input, fields: {...input.fields, marca: 'SAMSUNG'}}), '#posDraft=' + 'x'.repeat(7000)]) assert.equal(decodePosReceiptDraft(value), null);
});

test('fragment is removed before auth without writing browser storage or sending requests', () => {
  const url = new URL('https://fixture.example.test/?section=boletas&mode=nueva' + hash(input)); let cleaned;
  const draft = capturePosReceiptDraft({location: {href: url.href, hash: url.hash}, history: {replaceState: (_state, _title, href) => {cleaned = href;}}});
  assert.ok(draft); assert.equal(new URL(cleaned).hash, ''); assert.equal(new URL(cleaned).searchParams.get('posDraft'), null);
});

test('generation requires explicit confirmation; preparation sends nothing', async () => {
  let calls = 0; const confirmation = createPosReceiptConfirmation(async () => {calls++;});
  assert.equal(calls, 0);
  await assert.rejects(confirmation.confirm({}, decodePosReceiptDraft(hash(input)), false), {message: 'CONFIRMACION_REQUERIDA'});
  assert.equal(calls, 0);
});

test('double clicks and subsequent retries share one save result and force final duplicate check', async () => {
  let resolve, calls = 0, payload;
  const confirmation = createPosReceiptConfirmation(value => {calls++; payload = value; return new Promise(r => {resolve = r;});});
  const draft = decodePosReceiptDraft(hash(input));
  const first = confirmation.confirm({action: 'save'}, draft, true), second = confirmation.confirm({action: 'save'}, draft, true);
  resolve({id: 'fixture-id', reused: false});
  assert.deepEqual(await first, await second); assert.equal(payload.reuseExisting, true); assert.equal(calls, 1);
  assert.deepEqual(await confirmation.confirm({}, draft, true), await first); assert.equal(calls, 1);
});

test('failed requests never produce fake receipt success; manual retry remains possible', async () => {
  let calls = 0;
  const confirmation = createPosReceiptConfirmation(async () => {calls++; if (calls === 1) throw new Error('SERVICE_ERROR'); return {reused: true, id: 'existing'};});
  const draft = decodePosReceiptDraft(hash(input));
  await assert.rejects(confirmation.confirm({}, draft, true));
  assert.equal((await confirmation.confirm({}, draft, true)).reused, true); assert.equal(calls, 2);
});

test('expired drafts do not generate', async () => {
  let calls = 0; const confirmation = createPosReceiptConfirmation(async () => {calls++;}, {now: () => POS_DRAFT_TTL_MS + 1});
  await assert.rejects(confirmation.confirm({}, decodePosReceiptDraft(hash(input), 0), true), {message: 'BORRADOR_POS_EXPIRADO'}); assert.equal(calls, 0);
});


test('source invalidation checks exact origin and channel, and blocks confirmation', async () => {
  let listener, removed = false, calls = 0;
  const draft = {...decodePosReceiptDraft(hash(input)), posOrigin: 'https://comunicate-registros-v2.netlify.app', channelId: 'fixture-channel-123456'};
  const confirmation = createPosReceiptConfirmation(async () => {calls++;});
  const stop = subscribePosDraftInvalidation({addEventListener: (_name, fn) => {listener = fn;}, removeEventListener: () => {removed = true;}}, draft, () => confirmation.revoke());
  const data = {type: 'comunicate.pos-draft.invalidate', channelId: draft.channelId};
  listener({origin: 'https://untrusted.example.test', data});
  listener({origin: draft.posOrigin, data: {...data, channelId: 'wrong-channel'}});
  listener({origin: draft.posOrigin, data});
  await assert.rejects(confirmation.confirm({}, draft, true), {message: 'BORRADOR_POS_CAMBIO'}); assert.equal(calls, 0);
  stop(); assert.equal(removed, true);
});

test('draft revoked before protected screen mounts cannot generate later', async () => {
  const draft = {...decodePosReceiptDraft(hash(input)), revoked: true}; let calls = 0;
  const confirmation = createPosReceiptConfirmation(async () => {calls++;});
  await assert.rejects(confirmation.confirm({}, draft, true), {message: 'BORRADOR_POS_CAMBIO'}); assert.equal(calls, 0);
});
