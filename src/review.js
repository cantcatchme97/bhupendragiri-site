// Review mode. Loads only with ?review=<key>. The client taps anything on the page and leaves a note,
// then sends the notes as a revision round, or approves the site as final.
const KEY = new URLSearchParams(location.search).get('review');
const API = (p, opt = {}) => fetch(`/api/review/${p}${opt.method ? '' : `?k=${encodeURIComponent(KEY)}`}`, {
  method: opt.method || 'GET', headers: { 'content-type': 'application/json' },
  body: opt.body ? JSON.stringify({ ...opt.body, k: KEY }) : (opt.method && opt.method !== 'GET' ? JSON.stringify({ k: KEY }) : undefined),
}).then(r => r.json());

const css = `
.rv-panel{position:fixed;left:16px;bottom:16px;z-index:9999;width:min(360px,calc(100vw - 32px));max-height:min(70vh,560px);display:flex;flex-direction:column;background:#120E0C;color:#EFE8DC;border-radius:18px;box-shadow:0 20px 60px rgba(0,0,0,.45),inset 0 0 0 1px rgba(239,232,220,.14);font:400 14px/1.45 Manrope,system-ui,sans-serif;overflow:hidden}
.rv-panel.is-min{width:auto;max-height:none}
.rv-panel.is-min .rv-body,.rv-panel.is-min .rv-foot{display:none}
.rv-head{display:flex;align-items:center;gap:10px;padding:12px 14px;cursor:pointer;user-select:none}
.rv-head b{font-weight:600}.rv-head span{color:#b8b0a4;font-size:13px}.rv-head i{margin-left:auto;font-style:normal;color:#b8b0a4}
.rv-dot{width:8px;height:8px;border-radius:50%;background:#C8A15A;flex:none}
.rv-body{overflow:auto;padding:0 14px 6px;border-top:1px solid rgba(239,232,220,.1)}
.rv-sec{margin:12px 0 6px;font:600 11px/1 Manrope,sans-serif;letter-spacing:.12em;text-transform:uppercase;color:#C8A15A}
.rv-note{display:flex;gap:10px;padding:9px 0;border-bottom:1px solid rgba(239,232,220,.08);cursor:pointer}
.rv-note:last-child{border-bottom:0}
.rv-n{flex:none;width:22px;height:22px;border-radius:50%;display:grid;place-items:center;font:600 11px/1 Manrope,sans-serif;background:#C8A15A;color:#120E0C}
.rv-note.is-done .rv-n{background:#7FB77E}
.rv-note p{margin:0;flex:1}.rv-note small{display:block;color:#8a8278;font-size:12px;margin-top:2px}
.rv-x{all:unset;cursor:pointer;color:#8a8278;padding:0 4px;font-size:16px;line-height:22px}
.rv-x:hover{color:#EFE8DC}
.rv-log li{margin:4px 0}.rv-log{margin:0;padding-left:18px;color:#d9d0c2}
.rv-empty{color:#8a8278;padding:8px 0}
.rv-foot{display:grid;gap:8px;padding:12px 14px 14px;border-top:1px solid rgba(239,232,220,.1)}
.rv-btn{all:unset;box-sizing:border-box;text-align:center;cursor:pointer;min-height:42px;padding:11px 14px;border-radius:999px;font:600 14px/1.2 Manrope,sans-serif}
.rv-btn--add{background:#EFE8DC;color:#120E0C}.rv-btn--add.is-on{background:#C8A15A}
.rv-btn--send{box-shadow:inset 0 0 0 1.5px rgba(239,232,220,.5)}
.rv-btn--ok{background:#2f5b39;color:#fff}
.rv-btn[disabled]{opacity:.35;pointer-events:none}
.rv-row{display:grid;grid-template-columns:1fr 1fr;gap:8px}
.rv-msg{color:#d9d0c2;padding:10px 0}
.rv-hover{position:fixed;z-index:9997;pointer-events:none;outline:2px solid #C8A15A;outline-offset:2px;background:rgba(200,161,90,.12);border-radius:4px;transition:all .08s}
.rv-pin{position:fixed;z-index:9998;width:24px;height:24px;margin:-12px 0 0 -12px;border-radius:50%;display:grid;place-items:center;font:600 11px/1 Manrope,sans-serif;background:#C8A15A;color:#120E0C;box-shadow:0 2px 10px rgba(0,0,0,.4),0 0 0 2px #120E0C;cursor:pointer}
.rv-pin.is-done{background:#7FB77E}
.rv-ask{position:fixed;z-index:10000;left:50%;top:50%;transform:translate(-50%,-50%);width:min(420px,calc(100vw - 32px));background:#120E0C;color:#EFE8DC;border-radius:18px;padding:18px;box-shadow:0 30px 80px rgba(0,0,0,.6),inset 0 0 0 1px rgba(239,232,220,.14);font:400 14px/1.45 Manrope,system-ui,sans-serif}
.rv-ask h4{margin:0 0 4px;font:600 16px/1.3 Manrope,sans-serif}.rv-ask q{display:block;color:#b8b0a4;font-size:13px;margin-bottom:12px;quotes:none;max-height:3.2em;overflow:hidden}
.rv-ask textarea{width:100%;box-sizing:border-box;min-height:96px;resize:vertical;background:#1e1814;color:#EFE8DC;border:1px solid rgba(239,232,220,.2);border-radius:12px;padding:10px 12px;font:400 15px/1.4 Manrope,sans-serif}
.rv-ask textarea:focus{outline:2px solid #C8A15A;border-color:transparent}
.rv-ask .rv-row{margin-top:12px}
.rv-shade{position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,.45)}
html.rv-picking,html.rv-picking *{cursor:crosshair!important}
`;

let S = null, picking = false, hoverBox = null, pinsWrap = null;
const $ = (h) => { const d = document.createElement('div'); d.innerHTML = h.trim(); return d.firstElementChild; };
const esc = (t) => String(t || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const fmt = (t) => t ? new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) : '';
const ours = (el) => el.closest('.rv-panel,.rv-ask,.rv-shade,.rv-pin');

// a stable address for any element on the page
function selector(el) {
  if (el.id) return '#' + CSS.escape(el.id);
  const parts = [];
  while (el && el.nodeType === 1 && el !== document.body) {
    if (el.id) { parts.unshift('#' + CSS.escape(el.id)); break; }
    let i = 1, s = el; while ((s = s.previousElementSibling)) if (s.tagName === el.tagName) i++;
    parts.unshift(el.tagName.toLowerCase() + ':nth-of-type(' + i + ')');
    el = el.parentElement;
  }
  return parts.join(' > ');
}
const MEANING = 'img,video,h1,h2,h3,h4,p,a,button,figure,li,legend,label,input,span,em,b,svg';
const pickTarget = (el) => (el.closest(MEANING) || el);
const find = (n) => { try { return document.querySelector(n.sel); } catch { return null; } };
const roundNotes = () => S.notes.filter(n => n.round === S.round);

function render() {
  const panel = document.querySelector('.rv-panel');
  const min = panel.classList.contains('is-min');
  const mine = roundNotes();
  const past = S.rounds.filter(r => r.round < S.round || r.status === 'approved');
  const last = [...S.rounds].reverse().find(r => r.changes && r.changes.length);
  let body = '', foot = '';
  if (S.status === 'approved') {
    body = `<p class="rv-msg">Approved as final on ${fmt(S.rounds[S.rounds.length - 1].done)}. Thank you! 🙌</p>`;
  } else if (S.status === 'sent') {
    body = `<p class="rv-msg">Round ${S.round} is with Bhuvan (${mine.length} note${mine.length === 1 ? '' : 's'}). You'll get a message when the changes are live.</p>`;
  } else {
    foot = `<button class="rv-btn rv-btn--add${picking ? ' is-on' : ''}" data-a="add">${picking ? 'Tap anything on the page…' : '+ Add a note'}</button>
      <div class="rv-row"><button class="rv-btn rv-btn--send" data-a="send" ${mine.length ? '' : 'disabled'}>Send for revision</button><button class="rv-btn rv-btn--ok" data-a="approve">Approve as final</button></div>`;
  }
  if (last) body += `<div class="rv-sec">Changed in round ${last.round}</div><ul class="rv-log">${last.changes.map(c => `<li>${esc(c)}</li>`).join('')}</ul>`;
  body += `<div class="rv-sec">Round ${S.round} notes</div>` + (mine.length ? mine.map((n, i) => noteRow(n, i + 1, S.status === 'open')).join('') : `<p class="rv-empty">No notes yet. Tap "+ Add a note", then tap the photo, line or button you want changed.</p>`);
  if (past.length && S.notes.some(n => n.round < S.round)) body += `<div class="rv-sec">Earlier rounds</div>` + S.notes.filter(n => n.round < S.round).map((n, i) => noteRow(n, i + 1, false, true)).join('');
  panel.innerHTML = `<div class="rv-head" data-a="min"><span class="rv-dot"></span><b>Review</b><span>Round ${S.round}${S.status === 'approved' ? ' · approved' : ''}</span><i>${min ? '▴' : '▾'}</i></div><div class="rv-body">${body}</div>${foot ? `<div class="rv-foot">${foot}</div>` : ''}`;
  drawPins();
}
function noteRow(n, i, canDelete, old) {
  return `<div class="rv-note${n.status === 'done' || old ? ' is-done' : ''}" data-go="${n.id}"><span class="rv-n">${old ? '✓' : i}</span><p>${esc(n.note)}<small>${esc(n.text || n.tag)}${n.device ? ' · ' + n.device : ''}</small></p>${canDelete ? `<button class="rv-x" data-del="${n.id}" aria-label="Delete note">×</button>` : ''}</div>`;
}

function drawPins() {
  pinsWrap.innerHTML = '';
  if (!S || S.status === 'approved') return;
  roundNotes().forEach((n, i) => {
    const p = $(`<span class="rv-pin" data-go="${n.id}">${i + 1}</span>`); p._el = find(n); pinsWrap.appendChild(p);
  });
}
function placePins() {
  pinsWrap && [...pinsWrap.children].forEach(p => {
    const el = p._el; const r = el && el.getBoundingClientRect();
    const show = r && r.width && r.bottom > 0 && r.top < innerHeight && getComputedStyle(el).visibility !== 'hidden';
    p.style.display = show ? '' : 'none';
    if (show) { p.style.left = Math.min(innerWidth - 16, r.right - 8) + 'px'; p.style.top = Math.max(16, r.top + 8) + 'px'; }
  });
  requestAnimationFrame(placePins);
}

function goTo(id) {
  const n = S.notes.find(x => x.id === id); const el = n && find(n); if (!el) return;
  el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  const r = () => { const b = el.getBoundingClientRect(); Object.assign(hoverBox.style, { display: 'block', left: b.left + 'px', top: b.top + 'px', width: b.width + 'px', height: b.height + 'px' }); };
  setTimeout(r, 500); setTimeout(() => { if (!picking) hoverBox.style.display = 'none'; }, 2200);
}

function setPicking(on) {
  picking = on; document.documentElement.classList.toggle('rv-picking', on);
  if (!on) hoverBox.style.display = 'none';
  render();
}
function hover(e) {
  if (!picking || ours(e.target)) return;
  const b = pickTarget(e.target).getBoundingClientRect();
  Object.assign(hoverBox.style, { display: 'block', left: b.left + 'px', top: b.top + 'px', width: b.width + 'px', height: b.height + 'px' });
}
function pick(e) {
  if (!picking || ours(e.target)) return;
  e.preventDefault(); e.stopPropagation(); e.stopImmediatePropagation();
  const el = pickTarget(e.target);
  setPicking(false);
  const text = (el.alt || el.getAttribute('aria-label') || el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 140);
  const shade = $('<div class="rv-shade"></div>');
  const ask = $(`<div class="rv-ask" role="dialog" aria-label="Leave a note"><h4>What should change here?</h4><q>${esc(text || el.tagName.toLowerCase())}</q><textarea placeholder="e.g. Use a different photo here, or change this line to…"></textarea><div class="rv-row"><button class="rv-btn rv-btn--send" data-c="cancel">Cancel</button><button class="rv-btn rv-btn--add" data-c="save">Save note</button></div></div>`);
  document.body.append(shade, ask);
  const ta = ask.querySelector('textarea'); setTimeout(() => ta.focus(), 50);
  const close = () => { shade.remove(); ask.remove(); };
  shade.onclick = close;
  ask.onclick = async (ev) => {
    const c = ev.target.dataset.c; if (!c) return;
    if (c === 'cancel') return close();
    const note = ta.value.trim(); if (!note) return ta.focus();
    ev.target.textContent = 'Saving…';
    const r = await API('note', { method: 'POST', body: { note, sel: selector(el), text, tag: el.tagName.toLowerCase(), device: innerWidth < 760 ? 'phone' : 'computer', w: innerWidth } });
    if (r.ok) { S = { ...S, ...r }; close(); render(); } else { ev.target.textContent = 'Try again'; }
  };
}

function confirmBox(title, text, yes, onYes) {
  const shade = $('<div class="rv-shade"></div>');
  const ask = $(`<div class="rv-ask" role="dialog"><h4>${title}</h4><q>${text}</q><div class="rv-row"><button class="rv-btn rv-btn--send" data-c="no">Not yet</button><button class="rv-btn rv-btn--add" data-c="yes">${yes}</button></div></div>`);
  document.body.append(shade, ask);
  const close = () => { shade.remove(); ask.remove(); };
  shade.onclick = close;
  ask.onclick = async (ev) => { const c = ev.target.dataset.c; if (!c) return; if (c === 'yes') { ev.target.textContent = '…'; await onYes(); } close(); };
}

async function act(e) {
  const t = e.target.closest('[data-a],[data-del],[data-go]'); if (!t) return;
  e.stopPropagation();
  if (t.dataset.del) { const r = await API('note/' + t.dataset.del, { method: 'DELETE' }); if (r.ok) { S = { ...S, ...r }; render(); } return; }
  if (t.dataset.go) return goTo(t.dataset.go);
  const a = t.dataset.a;
  const panel = document.querySelector('.rv-panel');
  if (a === 'min') { panel.classList.toggle('is-min'); return render(); }
  if (a === 'add') return setPicking(!picking);
  if (a === 'send') {
    const n = roundNotes().length;
    return confirmBox(`Send ${n} note${n === 1 ? '' : 's'} for revision?`, 'Bhuvan gets them all at once and makes the changes in one round.', 'Send', async () => {
      const r = await API('send', { method: 'POST' }); if (r.ok) { S = { ...S, ...r }; render(); ping(`Hi Bhuvan, I've sent round ${S.round} of website changes (${n} note${n === 1 ? '' : 's'}).`); }
    });
  }
  if (a === 'approve') {
    const n = roundNotes().length;
    return confirmBox('Approve the website as final?', n ? `You still have ${n} unsent note${n === 1 ? '' : 's'} in this round. Approving skips them.` : 'Review mode closes and the site is ready to share.', 'Approve', async () => {
      const r = await API('approve', { method: 'POST' }); if (r.ok) { S = { ...S, ...r }; render(); ping('Hi Bhuvan, the website looks good. Approved as final ✅'); }
    });
  }
}
// tells Bhuvan on WhatsApp, if a number is set
function ping(text) { if (S.contact) window.open(`https://wa.me/${S.contact}?text=${encodeURIComponent(text)}`, '_blank', 'noopener'); }

export async function start() {
  if (!KEY) return;
  const r = await API('state').catch(() => null);
  if (!r || !r.ok) return; // review is off or the link is wrong: the site stays exactly as it is
  S = r;
  document.head.appendChild(Object.assign(document.createElement('style'), { textContent: css }));
  hoverBox = document.body.appendChild($('<div class="rv-hover" style="display:none"></div>'));
  pinsWrap = document.body.appendChild($('<div></div>'));
  const panel = document.body.appendChild($('<div class="rv-panel" role="region" aria-label="Review mode"></div>'));
  panel.addEventListener('click', act);
  pinsWrap.addEventListener('click', (e) => { const p = e.target.closest('[data-go]'); if (p) { e.stopPropagation(); goTo(p.dataset.go); } });
  document.addEventListener('pointermove', hover, true);
  document.addEventListener('click', pick, true);
  addEventListener('keydown', (e) => { if (e.key === 'Escape' && picking) setPicking(false); });
  render(); placePins();
}
