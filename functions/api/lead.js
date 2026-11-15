// Public endpoint: every WhatsApp tap on the site logs a lead here first, with the visitor's city from Cloudflare.
import { json, ensureTable, newId, clean } from '../_lib.js';

const SRC = (s) => s === 'camera' ? 'Website: camera brief' : String(s || '').startsWith('frame:') ? 'Website: frame' : 'Website: say hi';

export async function onRequestPost({ request, env }) {
  let b = {};
  try { b = await request.json(); } catch { return json({ ok: false }, 400); }
  if (b.website) return json({ ok: true }); // honeypot
  const cf = request.cf || {};
  const geo = [cf.city, cf.region, cf.country].filter(Boolean).join(', ');
  const now = Date.now();
  const frame = String(b.source || '').startsWith('frame:') ? String(b.source).slice(6).replace(':', ', frame ') : '';
  const kind = clean(b.kind, 60);
  const lead = {
    id: newId(), contact: clean(b.name, 120), brand: clean(b.brand, 120), phone: '', instagram: '',
    source: SRC(b.source), kind: kind ? kind[0].toUpperCase() + kind.slice(1) : '',
    when: [clean(b.when, 40), clean(b.city, 60)].filter(Boolean).join(', '), city: clean(b.city, 60),
    budget: '', quoted: '', final: '', advance: '', stage: 'new',
    followUp: new Date(now).toISOString().slice(0, 10), lostReason: '',
    notes: [clean(b.message, 800), frame && 'Tapped "Want this look?" on ' + frame, b.mood && 'Mood: ' + clean(b.mood, 60),
      geo && 'Visitor from ' + geo, b.ref && 'Came from ' + clean(b.ref, 200), b.utm && 'Campaign: ' + clean(b.utm, 120)].filter(Boolean).join('\n'),
    log: [{ t: now, text: 'Tapped WhatsApp on the website' + (geo ? ' from ' + geo : '') }]
  };
  await ensureTable(env.DB);
  await env.DB.prepare('INSERT INTO leads (id, data, created, updated) VALUES (?, ?, ?, ?)').bind(lead.id, JSON.stringify(lead), now, now).run();
  return json({ ok: true });
}
