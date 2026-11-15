// Private CRM API, behind the passcode cookie.
import { json, ensureTable, isAuthed, makeToken, newId } from '../../_lib.js';

const FIELDS = ['contact','brand','phone','instagram','source','kind','when','city','budget','quoted','final','advance','stage','followUp','lostReason','notes','log'];
const pick = (o) => { const r = {}; for (const k of FIELDS) if (o[k] !== undefined) r[k] = o[k]; return r; };

export async function onRequest({ request, env, params }) {
  const path = (params.path || []).join('/');
  const method = request.method;

  if (path === 'login' && method === 'POST') {
    // lockout: 5 wrong tries from one IP = locked for 15 minutes
    await env.DB.prepare('CREATE TABLE IF NOT EXISTS attempts (ip TEXT PRIMARY KEY, n INTEGER, until INTEGER)').run();
    const ip = request.headers.get('cf-connecting-ip') || 'local';
    const row = await env.DB.prepare('SELECT n, until FROM attempts WHERE ip = ?').bind(ip).first();
    if (row && row.until > Date.now()) return json({ ok: false, locked: true }, 429);
    const b = await request.json().catch(() => ({}));
    if (!env.CRM_PASSCODE || String(b.passcode || '') !== env.CRM_PASSCODE) {
      const n = (row && row.until <= Date.now() && row.until ? 0 : (row ? row.n : 0)) + 1;
      await env.DB.prepare('INSERT OR REPLACE INTO attempts (ip, n, until) VALUES (?, ?, ?)').bind(ip, n, n >= 5 ? Date.now() + 15 * 60e3 : 0).run();
      await new Promise(r => setTimeout(r, 800));
      return json({ ok: false }, 401);
    }
    await env.DB.prepare('DELETE FROM attempts WHERE ip = ?').bind(ip).run();
    return json({ ok: true }, 200, { 'set-cookie': `bg_crm=${encodeURIComponent(await makeToken(env))}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=2592000` });
  }
  if (path === 'logout') return json({ ok: true }, 200, { 'set-cookie': 'bg_crm=; Path=/; Max-Age=0' });
  if (!(await isAuthed(request, env))) return json({ ok: false, auth: false }, 401);

  await ensureTable(env.DB);
  const db = env.DB;

  if (path === 'clicks' && method === 'GET') {
    await db.prepare('CREATE TABLE IF NOT EXISTS clicks (t INTEGER NOT NULL, link TEXT, city TEXT, region TEXT, country TEXT, device TEXT)').run();
    const wk = Date.now() - 7 * 864e5;
    const tot = await db.prepare('SELECT COUNT(*) n FROM clicks').first();
    const week = await db.prepare('SELECT COUNT(*) n FROM clicks WHERE t > ?').bind(wk).first();
    const { results: cities } = await db.prepare("SELECT city, COUNT(*) n FROM clicks WHERE city != '' GROUP BY city ORDER BY n DESC LIMIT 5").all();
    const phone = await db.prepare("SELECT COUNT(*) n FROM clicks WHERE device = 'phone'").first();
    return json({ ok: true, total: tot.n, week: week.n, phone: phone.n, cities });
  }
  if (path === 'leads' && method === 'GET') {
    const { results } = await db.prepare('SELECT data FROM leads ORDER BY created DESC').all();
    return json({ ok: true, leads: results.map(r => JSON.parse(r.data)) });
  }
  if (path === 'leads' && method === 'POST') {           // create or update one lead
    const b = await request.json();
    const now = Date.now();
    if (b.id) {
      const row = await db.prepare('SELECT data FROM leads WHERE id = ?').bind(b.id).first();
      if (!row) return json({ ok: false }, 404);
      const lead = { ...JSON.parse(row.data), ...pick(b), id: b.id };
      await db.prepare('UPDATE leads SET data = ?, updated = ? WHERE id = ?').bind(JSON.stringify(lead), now, b.id).run();
      return json({ ok: true, lead });
    }
    const lead = { ...pick(b), id: newId() };
    await db.prepare('INSERT INTO leads (id, data, created, updated) VALUES (?, ?, ?, ?)').bind(lead.id, JSON.stringify(lead), now, now).run();
    return json({ ok: true, lead });
  }
  if (path === 'import' && method === 'POST') {
    const b = await request.json();
    const list = Array.isArray(b.leads) ? b.leads.slice(0, 2000) : [];
    const now = Date.now();
    const stmts = list.map((l, i) => { const lead = { ...pick(l), id: newId() + i }; return db.prepare('INSERT INTO leads (id, data, created, updated) VALUES (?, ?, ?, ?)').bind(lead.id, JSON.stringify(lead), now - i, now); });
    if (stmts.length) await db.batch(stmts);
    return json({ ok: true, added: stmts.length });
  }
  if (path.startsWith('leads/') && method === 'DELETE') {
    await db.prepare('DELETE FROM leads WHERE id = ?').bind(path.slice(6)).run();
    return json({ ok: true });
  }
  return json({ ok: false }, 404);
}
