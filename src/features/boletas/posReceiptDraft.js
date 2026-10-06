import {luhn} from '../../utils/imei.js';

export const POS_DRAFT_TTL_MS = 10 * 60 * 1000;
const fields = ['nombre', 'rut', 'tipoDocumento', 'imei1', 'imei2', 'marca', 'modelo', 'nombreComercial', 'sn', 'memoria', 'color'];
export function decodePosReceiptDraft(hash, now = Date.now()) {
  try {
    const raw = new URLSearchParams(String(hash || '').replace(/^#/, '')).get('posDraft');
    if (!raw || raw.length > 6000) return null;
    const input = JSON.parse(raw);
    if (input.version !== 1 || !luhn(input.selectedImei)) return null;
    const form = Object.fromEntries(fields.map(key => [key, String(input.fields?.[key] || '').trim().slice(0, 180)]));
    if (!luhn(form.imei1) || (form.imei2 && (!luhn(form.imei2) || form.imei1 === form.imei2))
      || ![form.imei1, form.imei2].includes(input.selectedImei) || form.marca !== 'APPLE') return null;
    // Price/date/number/emitter are never trusted from the URL.
    return {version: 1, selectedImei: input.selectedImei, fields: {...form, precio: ''}, fechaHora: '',
      automatic: fields.filter(key => Boolean(form[key])), receivedAt: now,
      posOrigin: String(input.posOrigin || ''), channelId: String(input.channelId || '')};
  } catch {return null;}
}
export function capturePosReceiptDraft(browser) {
  const draft = decodePosReceiptDraft(browser.location.hash);
  if (new URLSearchParams(browser.location.hash.replace(/^#/, '')).has('posDraft')) {
    const url = new URL(browser.location.href); url.hash = ''; browser.history.replaceState({}, '', url.href);
  }
  return draft;
}
// Capture once, before the login screen; popup authentication preserves memory.
export const incomingPosReceiptDraft = typeof window !== 'undefined' ? capturePosReceiptDraft(window) : null;

export function createPosReceiptConfirmation(save, {now = Date.now} = {}) {
  let pending = null, saved = null, revoked = false;
  return {
    revoke() {revoked = true;},
    async confirm(payload, draft, confirmed) {
      if (revoked || draft?.revoked) throw new Error('BORRADOR_POS_CAMBIO');
      if (!confirmed) throw new Error('CONFIRMACION_REQUERIDA');
      if (!draft || now() - draft.receivedAt > POS_DRAFT_TTL_MS) throw new Error('BORRADOR_POS_EXPIRADO');
      if (saved) return saved;
      if (pending) return pending;
      pending = save({...payload, reuseExisting: true});
      try {saved = await pending; return saved;} finally {pending = null;}
    },
  };
}


export function subscribePosDraftInvalidation(browser, draft, onInvalidate) {
  const allowed = draft?.posOrigin === 'https://comunicate-registros-v2.netlify.app' || draft?.posOrigin === 'https://comunicate-tacna.web.app'
    || /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(draft?.posOrigin || '');
  if (!allowed || !/^[a-zA-Z0-9-]{16,80}$/.test(draft.channelId || '')) return () => {};
  const listener = event => {
    if (event.origin === draft.posOrigin && event.data?.type === 'comunicate.pos-draft.invalidate' && event.data.channelId === draft.channelId) onInvalidate();
  };
  browser.addEventListener('message', listener);
  return () => browser.removeEventListener('message', listener);
}


// Listen before login, so changing the POS IMEI while signing in also revokes the draft.
if (incomingPosReceiptDraft && typeof window !== 'undefined') {
  subscribePosDraftInvalidation(window, incomingPosReceiptDraft, () => {incomingPosReceiptDraft.revoked = true;});
}
