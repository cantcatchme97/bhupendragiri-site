// Review mode: the client leaves notes on any part of the site, sends them as a revision round, or approves the site as final.
// Off unless env REVIEW = "on"; the client's link carries env REVIEW_KEY.
import { json, newId, clean } from '../../_lib.js';

async function tables(db) {
  await db.batch([
    db.prepare('CREATE TABLE IF NOT EXISTS review_notes (id TEXT PRIMARY KEY, round INTEGER NOT NULL, data TEXT NOT NULL, status TEXT NOT NULL, created INTEGER NOT NULL)'),
    db.prepare('CREATE TABLE IF NOT EXISTS review_rounds (round INTEGER PRIMARY KEY, status TEXT NOT NULL, sent INTEGER, done INTEGER, changes TEXT)'),
    db.prepare("INSERT OR IGNORE INTO review_rounds (round, status) VALUES (1, 'open')"),
  ]);
}

async function state(db) {
  const { results: rounds } = await db.prepare('SELECT * FROM review_rounds ORDER BY round').all();
  const { results: notes } = await db.prepare('SELECT * FROM review_notes ORDER BY created').all();
  const cur = rounds[rounds.length - 1];
  return {
    round: cur.round, status: cur.status,
    rounds: rounds.map(r => ({ round: r.round, status: r.status, sent: r.sent, done: r.done, changes: r.changes ? JSON.parse(r.changes) : [] })),
    notes: notes.map(n => ({ id: n.id, round: n.round, status: n.status, created: n.created, ...JSON.parse(n.data) })),
  };
}

export async function onRequest({ request, env, params }) {
  const path = (params.path || []).join('/');
  const url = new URL(request.url);
  let body = {};
  if (request.method === 'POST') { try { body = await request.json(); } catch {} }
  const key = url.searchParams.get('k') || body.k;
  if (env.REVIEW !== 'on' || !env.REVIEW_KEY || key !== env.REVIEW_KEY) return json({ ok: false, off: true }, 403);

  const db = env.DB;
  await tables(db);
  const s = await state(db);

  if (path === 'state') return json({ ok: true, ...s, contact: env.REVIEW_WA || '' });
  if (s.status === 'approved') return json({ ok: false, error: 'approved' }, 409);

  if (path === 'note' && request.method === 'POST') {
    if (s.status !== 'open') return json({ ok: false, error: 'round sent' }, 409);
    const data = { note: clean(body.note, 1000), sel: clean(body.sel, 600), text: clean(body.text, 160), tag: clean(body.tag, 20), device: clean(body.device, 20), w: +body.w || 0, by: clean(body.by, 60) };
    if (!data.note) return json({ ok: false }, 400);
    await db.prepare("INSERT INTO review_notes (id, round, data, status, created) VALUES (?, ?, ?, 'open', ?)").bind(newId(), s.round, JSON.stringify(data), Date.now()).run();
    return json({ ok: true, ...(await state(db)) });
  }
  if (path.startsWith('note/') && request.method === 'DELETE') {
    await db.prepare("DELETE FROM review_notes WHERE id = ? AND round = ? AND status = 'open'").bind(path.slice(5), s.round).run();
    return json({ ok: true, ...(await state(db)) });
  }
  if (path === 'send' && request.method === 'POST') {
    if (s.status !== 'open' || !s.notes.some(n => n.round === s.round)) return json({ ok: false, error: 'nothing to send' }, 409);
    await db.prepare("UPDATE review_rounds SET status = 'sent', sent = ? WHERE round = ?").bind(Date.now(), s.round).run();
    return json({ ok: true, ...(await state(db)) });
  }
  if (path === 'approve' && request.method === 'POST') {
    await db.prepare("UPDATE review_rounds SET status = 'approved', done = ? WHERE round = ?").bind(Date.now(), s.round).run();
    return json({ ok: true, ...(await state(db)) });
  }
  return json({ ok: false }, 404);
}
