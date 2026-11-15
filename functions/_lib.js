// Shared helpers for the CRM API (Cloudflare Pages Functions + D1).
export const json = (data, status = 200, headers = {}) =>
  new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });

export async function ensureTable(db) {
  await db.prepare('CREATE TABLE IF NOT EXISTS leads (id TEXT PRIMARY KEY, data TEXT NOT NULL, created INTEGER NOT NULL, updated INTEGER NOT NULL)').run();
}

const enc = new TextEncoder();
async function hmac(secret, msg) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(msg));
  return [...new Uint8Array(sig)].map(b => b.toString(16).padStart(2, '0')).join('');
}
export async function makeToken(env) {
  const exp = Date.now() + 30 * 864e5;
  return `${exp}.${await hmac(env.CRM_SECRET, 'crm:' + exp + ':' + env.CRM_PASSCODE)}`;
}
export async function isAuthed(request, env) {
  const c = request.headers.get('cookie') || '';
  const m = c.match(/(?:^|;\s*)bg_crm=([^;]+)/);
  if (!m) return false;
  const [exp, sig] = decodeURIComponent(m[1]).split('.');
  if (!exp || !sig || +exp < Date.now()) return false;
  return sig === await hmac(env.CRM_SECRET, 'crm:' + exp + ':' + env.CRM_PASSCODE);
}
export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
export const clean = (v, n = 400) => (v == null ? '' : String(v)).trim().slice(0, n);
