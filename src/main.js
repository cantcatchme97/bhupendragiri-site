import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import Lenis from 'lenis';
import { SHOOTS, CHAPTERS, SETS, WHATSAPP, shot, bySlug } from './data.js';
import { CITIES } from './cities.js';

gsap.registerPlugin(ScrollTrigger);
const $ = (s, r = document) => r.querySelector(s);
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const small = () => matchMedia('(max-width: 760px)').matches;

/* ---------- WhatsApp links ---------- */
const wa = (text) => `https://wa.me/${WHATSAPP}?text=${encodeURIComponent(text)}`;
const hello = "Hi Bhupendra! Saw your website. Got a minute to talk about a shoot?";
['waFloat', 'waFoot'].forEach(id => { const a = document.getElementById(id); if (a) a.href = wa(hello); });
/* every tap that opens WhatsApp is logged as a lead first (works once the site is on Cloudflare; silent in previews) */
const params = new URLSearchParams(location.search);
const visit = { ref: document.referrer || '', utm: ['utm_source', 'utm_medium', 'utm_campaign'].map(k => params.get(k)).filter(Boolean).join(' / ') };
const reviewing = params.has('review');
// review mode: the client's notes tool loads only with the review link, and their taps are not logged as leads
if (reviewing) import('./review.js').then(m => m.start());
const logLead = (source, data = {}) => {
  if (reviewing) return;
  try {
    const body = JSON.stringify({ source, page: location.pathname, ...visit, ...data });
    navigator.sendBeacon && navigator.sendBeacon('/api/lead', new Blob([body], { type: 'application/json' }));
    window.posthog && window.posthog.capture('whatsapp_click', { source, ...data });
  } catch (e) { /* never block the WhatsApp tap */ }
};
document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="https://wa.me/"]'); if (!a || a.dataset.logged) return;
  const msg = decodeURIComponent((a.href.split('text=')[1] || ''));
  logLead(a.dataset.source || a.id || 'whatsapp', { message: msg });
}, true);

/* ---------- smooth scroll ---------- */
let lenis = null;
if (!reduce) {
  lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 0.9 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
}
document.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', (e) => {
  const id = a.getAttribute('href'); if (id.length < 2) return;
  const el = document.querySelector(id); if (!el) return;
  e.preventDefault();
  lenis ? lenis.scrollTo(el, { duration: 1.6 }) : el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth' });
}));

/* ---------- loader ---------- */
const heroVideo = $('#heroVideo');
// phones get their own vertical file in full quality; desktop starts on a light copy so it moves
// at once even on a hotspot, then swaps to the sharp original as soon as that has loaded
// blind test: ?h=a or ?h=b forces one file with no swap
const blind = new URLSearchParams(location.search).get('h');
const blindLite = blind === 'a';
const heroSrc = blind ? (small() ? 'media/films/hero-m-v6.mp4' : (blindLite ? 'media/films/hero-v6-lite.mp4' : 'media/films/hero-v5.mp4'))
  : (small() ? 'media/films/hero-m-v6.mp4' : 'media/films/hero-v6-lite.mp4');
const heroHD = small() || blind ? null : 'media/films/hero-v5.mp4';
heroVideo.poster = small() ? 'media/films/hero-m-v5.webp' : 'media/films/hero-v5.webp';
heroVideo.src = heroSrc;

/* ---------- keep the opening film playing, whatever the phone or network does ----------
   - iPhones in Low Power Mode or Low Data Mode refuse to autoplay any <video>. Safari still plays
     an mp4 inside an <img> like a GIF, so we show that instead until the visitor first touches the page.
   - Slow networks or a tab coming back from the background can leave the film paused: we retry. */
let hero = heroVideo, heroImg = null, heroInView = true;
const prep = (v) => { v.muted = true; v.defaultMuted = true; v.playsInline = true; v.setAttribute('webkit-playsinline', ''); v.loop = true; };
prep(hero);
const dropHeroImg = () => { if (!heroImg) return; const im = heroImg; heroImg = null; gsap.to(im, { opacity: 0, duration: 0.5, onComplete: () => im.remove() }); };
const showHeroImg = () => {
  if (heroImg || document.querySelector('.opening__gif')) return;
  const im = new Image(); im.className = 'opening__video opening__gif'; im.alt = ''; im.setAttribute('aria-hidden', 'true');
  im.onload = () => { if (hero.paused) { heroImg = im; hero.after(im); } };
  im.onerror = () => {};
  im.src = heroSrc;
};
const playHero = () => {
  if (!heroInView || document.hidden || !hero.paused) return;
  const p = hero.play();
  if (p && p.catch) p.catch(err => { if (err && err.name === 'NotAllowedError') showHeroImg(); });
};
hero.addEventListener('playing', dropHeroImg);
['loadeddata', 'canplay', 'stalled', 'suspend'].forEach(e => hero.addEventListener(e, playHero));
document.addEventListener('visibilitychange', playHero);
addEventListener('pageshow', playHero);
['touchend', 'pointerup', 'click', 'keydown'].forEach(e => addEventListener(e, playHero, { passive: true }));
new IntersectionObserver(([en]) => { heroInView = en.isIntersecting; if (heroInView) playHero(); else hero.pause(); }).observe($('#opening'));
setInterval(playHero, 1500);

/* start fast, then sharpen: load the sharp film in the background and cross-fade to it on the same frame */
const conn = navigator.connection || {};
if (heroHD && !conn.saveData && !/(^|-)2g/.test(conn.effectiveType || '')) {
  let started = false;
  const startHD = () => {
    if (started) return; started = true;
    const hd = document.createElement('video'); prep(hd); hd.preload = 'auto';
    hd.className = 'opening__video'; hd.setAttribute('aria-hidden', 'true'); hd.style.opacity = '0';
    hd.addEventListener('canplaythrough', () => {
      if (hd.dataset.on) return; hd.dataset.on = '1';
      const lite = hero; hero.after(hd);
      hd.currentTime = (lite.currentTime + 0.25) % (lite.duration || 12);
      const go = () => {
        const p = hd.play(); if (!p || !p.then) return;
        p.then(() => {
          hero = hd; hd.removeAttribute('aria-hidden');
          hd.addEventListener('playing', dropHeroImg); ['stalled', 'suspend'].forEach(e => hd.addEventListener(e, playHero));
          gsap.to(hd, { opacity: 1, duration: 0.6, ease: 'power1.inOut', onComplete: () => { lite.pause(); lite.removeAttribute('src'); lite.load(); lite.remove(); hd.id = 'heroVideo'; } });
        }).catch(() => { hd.remove(); });
      };
      hd.seeking ? hd.addEventListener('seeked', go, { once: true }) : go();
    }, { once: false });
    hd.src = heroHD; hd.load();
  };
  // only once the light film has fully downloaded, so the sharp one never makes it stall
  const lite = heroVideo;
  const ready = () => { const b = lite.buffered; if (b.length && b.end(b.length - 1) >= (lite.duration || 12) - 0.2) startHD(); };
  ['progress', 'timeupdate', 'canplaythrough'].forEach(e => lite.addEventListener(e, ready));
}
// no loader: the first frame is on screen at once, the film takes over as soon as it can play
playHero();
if (!reduce) gsap.from('.opening__name, .opening__line, .opening__title .btn', { y: 18, duration: 0.9, ease: 'power3.out', stagger: 0.05 });

/* ---------- opening: the film sinks into the page ---------- */
const mm = gsap.matchMedia();
mm.add({ motion: '(prefers-reduced-motion: no-preference)' }, () => {
  gsap.timeline({ scrollTrigger: { trigger: '#opening', start: 'top top', end: 'bottom bottom', scrub: 0.6 } })
    .to('#openFrame', { scale: () => small() ? 0.74 : 0.54, y: () => innerHeight * (small() ? 0.16 : 0.15), ease: 'none' }, 0)
    .to('.opening__title', { opacity: 0, ease: 'none', duration: 0.35 }, 0)
    .to('#openStatement', { opacity: 1, y: 0, ease: 'none', duration: 0.4 }, 0.35)
    .fromTo('#openStatement', { y: 30 }, { y: 0, ease: 'none', duration: 0.4 }, 0.35);
});
// nav switches to ink whenever a light section sits under it
const nav = $('#nav');
const lightEls = () => [...document.querySelectorAll('#work')];
let lights = lightEls();
const navInk = () => {
  const y = 34;
  let ink = lights.some(el => { const r = el.getBoundingClientRect(); return r.top <= y && r.bottom > y; });
  const op = $('#opening'); if (op) { const r = op.getBoundingClientRect(); if (r.top <= 0 && r.bottom > y && -r.top > op.offsetHeight * 0.3) ink = true; }
  nav.classList.toggle('is-ink', ink);
  nav.classList.toggle('is-scrolled', window.scrollY > 60);
};
// check only when the page moves, not on every frame
let navRaf = 0;
const navSoon = () => { if (!navRaf) navRaf = requestAnimationFrame(() => { navRaf = 0; navInk(); }); };
addEventListener('scroll', navSoon, { passive: true }); addEventListener('resize', navSoon); navInk();
ScrollTrigger.create({ trigger: '#sets', start: 'top 60%', onEnter: () => $('#waFloat').classList.add('is-on'), onLeaveBack: () => $('#waFloat').classList.remove('is-on') });

/* ---------- the sets: two frames, the name across the seam ---------- */
const steps = (el, n) => { el.innerHTML = Array.from({ length: n }, () => '<span><i></i></span>').join(''); return [...el.querySelectorAll('i')]; };
const fillSteps = (bars, p) => { const n = bars.length; bars.forEach((b, k) => { b.style.transform = `scaleX(${Math.max(0, Math.min(1, p * n - k))})`; }); };
const pair = $('#setsPair');
pair.innerHTML = SETS.map((s, i) => `<div class="sets__card${i === 0 ? ' is-on' : ''}" data-i="${i}"><figure class="sets__a"><img src="${shot(s.slug, s.a)}" alt="" loading="lazy" fetchpriority="low"></figure><figure class="sets__b"><img src="${shot(s.slug, s.b)}" alt="" loading="lazy" fetchpriority="low"></figure></div>`).join('');
$('#setList').innerHTML = SETS.map((s, i) => `<li data-i="${i}" class="${i ? '' : 'is-on'}"><button type="button" data-slug="${s.slug}">${bySlug(s.slug).title}</button></li>`).join('');
$('#setList').addEventListener('click', (e) => { const b = e.target.closest('button'); if (b) openShoot(b.dataset.slug); });
pair.addEventListener('click', () => openShoot(SETS[lastSet].slug));
const setBars = steps($('#setSteps'), SETS.length);
let lastSet = 0;
const setSet = (i) => {
  pair.querySelectorAll('.sets__card').forEach((c, k) => c.classList.toggle('is-on', k === i));
  $('#setList').querySelectorAll('li').forEach((li, k) => li.classList.toggle('is-on', k === i));
  gsap.fromTo(['#setName', '#setLine'], { opacity: 0, y: 18 }, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.06, overwrite: true, onStart: () => { const sh = bySlug(SETS[i].slug); $('#setName').textContent = sh.title; $('#setLine').textContent = sh.line; } });
};
const setsST = ScrollTrigger.create({
  trigger: '#sets', start: 'top top', end: 'bottom bottom', scrub: true,
  onUpdate: (st) => {
    fillSteps(setBars, st.progress);
    const i = Math.min(SETS.length - 1, Math.floor(st.progress * SETS.length));
    if (i !== lastSet) { lastSet = i; setSet(i); }
    // the pair drifts apart a little inside each set
    const local = st.progress * SETS.length - i;
    gsap.set('.sets__card.is-on .sets__a', { yPercent: (0.5 - local) * 6 });
    gsap.set('.sets__card.is-on .sets__b', { yPercent: (local - 0.5) * 6 });
  },
});
const snapInside = (st, n) => {
  let timer = 0;
  const settle = () => {
    if (!st.isActive) return;
    const span = st.end - st.start, p = (scrollY - st.start) / span;
    if (p <= 0.01 || p >= 0.99) return;
    const i = Math.min(n - 1, Math.floor(p * n)), goal = st.start + span * ((i + 0.5) / n);
    if (Math.abs(goal - scrollY) < 4) return;
    lenis ? lenis.scrollTo(goal, { duration: 0.7, easing: (t) => 1 - Math.pow(1 - t, 3) }) : scrollTo({ top: goal, behavior: 'smooth' });
  };
  const kick = () => { clearTimeout(timer); timer = setTimeout(settle, 160); };
  lenis ? lenis.on('scroll', (l) => { if (Math.abs(l.velocity) < 0.2) kick(); else clearTimeout(timer); }) : addEventListener('scroll', kick, { passive: true });
};
if (!reduce && !matchMedia('(pointer: coarse)').matches) snapInside(setsST, SETS.length);

/* ---------- the shoots: an index by chapter, a glimpse on hover, the whole shoot on click ---------- */
// keep small words with the next word, and the last two words together, so lines never end on 'a' or 'of'
const glue = (t) => t.replace(/\b(a|an|and|the|of|in|for|on|to|at|by|with) /gi, '$1\u00a0').replace(/ (\S+)$/, '\u00a0$1');
const chapEl = $('#chapters');
chapEl.innerHTML = CHAPTERS.map(c => {
  const list = SHOOTS.filter(s => s.chapter === c.id);
  return `<div class="chap">
    <p class="chap__head"><span class="chap__no">${c.no}</span><span class="chap__name">${c.name}</span><span class="chap__count">${list.length} shoots</span></p>
    <ul class="chap__list">${list.map(s => `<li><button type="button" class="row" data-slug="${s.slug}">
      <span class="row__thumb"><img data-src="${shot(s.slug, 1, 800)}" alt=""></span>
      <span class="row__title">${glue(s.title)}</span>
      <span class="row__line">${glue(s.line)}</span>
      <span class="row__meta">${s.n} frames &middot; ${s.year}</span>
      <span class="row__open" aria-hidden="true">View</span></button></li>`).join('')}</ul></div>`;
}).join('');
const wakeThumbs = () => chapEl.querySelectorAll('img[data-src]').forEach(im => { if (!im.src) im.src = im.dataset.src; });
ScrollTrigger.create({ trigger: '#work', start: 'top 180%', once: true, onEnter: wakeThumbs });
chapEl.addEventListener('click', (e) => { const b = e.target.closest('.row'); if (b) openShoot(b.dataset.slug); });
if (!matchMedia('(hover: hover) and (pointer: fine)').matches && !reduce) {
  const live = new Set();
  const io = new IntersectionObserver(es => es.forEach(e => e.isIntersecting ? live.add(e.target) : live.delete(e.target)), { threshold: 0.6 });
  chapEl.querySelectorAll('.row').forEach(r => io.observe(r));
  let tick = 0;
  setInterval(() => { tick++; live.forEach(r => { const sh = bySlug(r.dataset.slug), im = r.querySelector('.row__thumb img'); if (!im || !im.src) return; im.src = shot(sh.slug, (tick % sh.n) + 1, 800); }); }, 1600);
}
// the peek: on a mouse, the shoot's first frame follows the cursor over the list
const peek = $('#peek'), peekImg = peek.querySelector('img');
if (matchMedia('(hover: hover) and (pointer: fine)').matches && !reduce) {
  const px = gsap.quickTo(peek, 'x', { duration: 0.5, ease: 'power3' }), py = gsap.quickTo(peek, 'y', { duration: 0.5, ease: 'power3' });
  let peekSlug = '', flipId = 0;
  chapEl.addEventListener('pointermove', (e) => { px(e.clientX); py(e.clientY); });
  chapEl.addEventListener('pointerover', (e) => {
    const b = e.target.closest('.row'); if (!b) return;
    if (b.dataset.slug !== peekSlug) {
      peekSlug = b.dataset.slug; clearInterval(flipId);
      // a flip-book of the frames the row thumbnail doesn't show
      const sh = bySlug(peekSlug), frames = Array.from({ length: sh.n - 1 }, (_, k) => k + 2); let f = 0;
      const show = () => { peekImg.src = shot(peekSlug, frames[f % frames.length], 800); f++; };
      frames.forEach(n => { const im = new Image(); im.src = shot(peekSlug, n, 800); });
      show(); flipId = setInterval(show, 650);
      gsap.fromTo(peekImg, { scale: 1.12 }, { scale: 1, duration: 0.7, ease: 'power3.out' });
    }
    peek.classList.add('is-on');
  });
  chapEl.addEventListener('pointerleave', () => { peek.classList.remove('is-on'); peekSlug = ''; clearInterval(flipId); });
}
mm.add({ motion: '(prefers-reduced-motion: no-preference)' }, () => {
  gsap.from('.shoots__head > *', { y: 30, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.08, scrollTrigger: { trigger: '#work', start: 'top 75%' } });
  gsap.utils.toArray('.chap__list li').forEach((li) => gsap.from(li, { y: 30, opacity: 0, duration: 0.8, ease: 'power3.out', scrollTrigger: { trigger: li, start: 'top 92%' } }));
  gsap.utils.toArray('.chap__head').forEach((h) => gsap.from(h, { clipPath: 'inset(0 100% 0 0)', duration: 1.1, ease: 'power3.inOut', scrollTrigger: { trigger: h, start: 'top 88%' } }));
});

/* ---------- the viewer: one shoot, frame by frame ---------- */
const viewer = $('#viewer'), strip = $('#vStrip');
let vShoot = null, vIdx = 0, lastFocus = null;
const romans = ['I', 'II', 'III', 'IV'];
function openShoot(slug) {
  const sh = bySlug(slug); if (!sh) return;
  vShoot = sh; vIdx = 0; lastFocus = document.activeElement;
  const ch = CHAPTERS.find(c => c.id === sh.chapter);
  $('#vNo').textContent = ch ? `${ch.no} · ${ch.name}` : 'IV · Off the clock';
  $('#vTitle').textContent = sh.title; $('#vLine').textContent = sh.line;
  strip.innerHTML = Array.from({ length: sh.n }, (_, k) => `<figure class="viewer__frame"><img src="${shot(sh.slug, k + 1)}" alt="${sh.title}, frame ${k + 1} of ${sh.n}" width="1280" height="1600" decoding="async" ${k > 2 ? 'fetchpriority="low"' : ''}><a class="viewer__want" data-source="frame:${sh.slug}:${k + 1}" href="${wa(`Hi Bhupendra, I loved frame ${k + 1} from ${sh.title}. Can we plan something in this mood?`)}" target="_blank" rel="noopener">Want this look?</a></figure>`).join('');
  viewer.hidden = false; document.documentElement.classList.add('has-viewer');
  lenis && lenis.stop();
  strip.scrollLeft = 0; strip.scrollTop = 0; setCount();
  if (!reduce) {
    gsap.fromTo(viewer, { clipPath: 'inset(100% 0 0 0)' }, { clipPath: 'inset(0% 0 0 0)', duration: 0.8, ease: 'power4.inOut' });
    gsap.from(strip.querySelectorAll('.viewer__frame'), { y: 60, opacity: 0, duration: 0.9, ease: 'power3.out', stagger: 0.06, delay: 0.35 });
    gsap.from('.viewer__meta > *, .viewer__count, .viewer__close', { y: 16, opacity: 0, duration: 0.6, stagger: 0.05, delay: 0.4 });
  }
  setTimeout(() => $('#vClose').focus(), 50);
}
function closeShoot() {
  if (viewer.hidden) return;
  const done = () => { viewer.hidden = true; document.documentElement.classList.remove('has-viewer'); lenis && lenis.start(); lastFocus && lastFocus.focus && lastFocus.focus({ preventScroll: true }); };
  reduce ? done() : gsap.to(viewer, { clipPath: 'inset(0 0 100% 0)', duration: 0.6, ease: 'power3.inOut', onComplete: done });
}
const frameEls = () => [...strip.querySelectorAll('.viewer__frame')];
const horizontal = () => getComputedStyle(strip).overflowX !== 'hidden' && strip.scrollWidth > strip.clientWidth + 4;
function setCount() {
  if (!vShoot) return;
  const fs = frameEls(); let best = 0, bestD = Infinity;
  const sr = strip.getBoundingClientRect(), mid = horizontal() ? sr.left + sr.width / 2 : sr.top + sr.height / 2;
  fs.forEach((f, k) => { const r = f.getBoundingClientRect(); const c = horizontal() ? r.left + r.width / 2 : r.top + r.height / 2; const d = Math.abs(c - mid); if (d < bestD) { bestD = d; best = k; } });
  const atEnd = horizontal() ? strip.scrollLeft + strip.clientWidth >= strip.scrollWidth - 4 : strip.scrollTop + strip.clientHeight >= strip.scrollHeight - 4;
  const moved = horizontal() ? strip.scrollLeft > 4 : strip.scrollTop > 4;
  if (!moved) best = 0; else if (atEnd) best = fs.length - 1;
  vIdx = best; $('#vCount').textContent = `${String(best + 1).padStart(2, '0')} / ${String(vShoot.n).padStart(2, '0')}`;
}
function goFrame(d) {
  const fs = frameEls(); const k = Math.max(0, Math.min(fs.length - 1, vIdx + d)); const f = fs[k]; if (!f) return;
  if (horizontal()) strip.scrollTo({ left: f.offsetLeft - (strip.clientWidth - f.offsetWidth) / 2, behavior: reduce ? 'auto' : 'smooth' });
  else strip.scrollTo({ top: f.offsetTop - 70, behavior: reduce ? 'auto' : 'smooth' });
}
strip.addEventListener('scroll', () => requestAnimationFrame(setCount), { passive: true });
// a mouse wheel moves the strip sideways on desktop
strip.addEventListener('wheel', (e) => { if (!horizontal()) return; if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { e.preventDefault(); strip.scrollLeft += e.deltaY; } }, { passive: false });
$('#vClose').addEventListener('click', closeShoot);
$('#vPrev').addEventListener('click', () => goFrame(-1));
$('#vNext').addEventListener('click', () => goFrame(1));
addEventListener('keydown', (e) => {
  if (viewer.hidden) return;
  if (e.key === 'Escape') closeShoot();
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') { e.preventDefault(); goFrame(1); }
  if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') { e.preventDefault(); goFrame(-1); }
  if (e.key === 'Tab') { const f = [...viewer.querySelectorAll('button, a')]; const i = f.indexOf(document.activeElement); if (e.shiftKey && i <= 0) { e.preventDefault(); f[f.length - 1].focus(); } else if (!e.shiftKey && i === f.length - 1) { e.preventDefault(); f[0].focus(); } }
});

/* ---------- the roads: personal work drifts sideways as you scroll ---------- */
const roads = SHOOTS.filter(s => s.chapter === 'off');
const track = $('#roadsTrack');
track.innerHTML = roads.flatMap(s => Array.from({ length: s.n }, (_, k) => `<button type="button" class="roads__item" data-slug="${s.slug}"><img data-src="${shot(s.slug, k + 1, 800)}" alt="${s.title}, frame ${k + 1}"><span>${s.title}</span></button>`)).join('');
ScrollTrigger.create({ trigger: '#roads', start: 'top 160%', once: true, onEnter: () => track.querySelectorAll('img[data-src]').forEach(im => { im.src = im.dataset.src; }) });
track.addEventListener('click', (e) => { const b = e.target.closest('.roads__item'); if (b) openShoot(b.dataset.slug); });
// no pinning: the strip drifts on its own while it's on screen, pauses under the finger or mouse,
// and can be swiped or dragged; the page keeps scrolling past it as normal
if (!reduce) {
  let onScreen = false, held = false, pos = 0;
  new IntersectionObserver(([e]) => { onScreen = e.isIntersecting; if (onScreen) pos = track.scrollLeft; }, { threshold: 0.2 }).observe(track);
  ['pointerenter', 'touchstart', 'focusin'].forEach(ev => track.addEventListener(ev, () => { held = true; }, { passive: true }));
  ['pointerleave', 'touchend', 'focusout'].forEach(ev => track.addEventListener(ev, () => { held = false; pos = track.scrollLeft; }, { passive: true }));
  gsap.ticker.add((t, dt) => {
    if (!onScreen || held || viewer && !viewer.hidden) return;
    const max = track.scrollWidth - track.clientWidth; if (max <= 0) return;
    pos += dt * 0.045; if (pos >= max) pos = 0;
    track.scrollLeft = pos;
  });
}

/* ---------- contact sheet: nine BTS frames, a grease-pencil circle, each frame plays ---------- */
const film = $('#sheetFilm');
const PICK = ['01', '03', '04', '05', '06', '07', '08', '11', '12'], marked = [4, 8];
film.innerHTML = PICK.map((n, k) => {
  return `<button type="button" class="sheet__frame${marked.includes(k + 1) ? ' is-marked' : ''}" data-n="${n}" aria-label="Play behind the scenes clip ${k + 1}">
    <img data-src="media/bts/${n}.jpg" alt="">
    <span class="sheet__no">${k + 1}<i>${k + 1}A</i></span>
    ${marked.includes(k + 1) ? '<svg class="sheet__circle" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M50 4C22 3 5 22 6 50s20 46 46 46 44-18 43-47S74 6 46 7"/></svg>' : ''}
  </button>`;
}).join('');
ScrollTrigger.create({ trigger: '#bts', start: 'top 170%', once: true, onEnter: () => film.querySelectorAll('img[data-src]').forEach(im => { im.src = im.dataset.src; }) });
let playing = null;
const stopFrame = (b) => { if (!b) return; const v = b.querySelector('video'); if (v) { v.pause(); v.remove(); } b.classList.remove('is-playing'); };
const playFrame = (b) => {
  if (playing === b) { stopFrame(b); playing = null; return; }
  stopFrame(playing); playing = b;
  const v = document.createElement('video'); v.muted = true; v.loop = true; v.playsInline = true; v.setAttribute('playsinline', '');
  v.src = `media/bts/${b.dataset.n}.mp4`; b.appendChild(v); b.classList.add('is-playing'); v.play().catch(() => {});
};
film.addEventListener('click', (e) => { const b = e.target.closest('.sheet__frame'); if (b) playFrame(b); });
if (matchMedia('(hover: hover) and (pointer: fine)').matches) {
  film.addEventListener('pointerover', (e) => { const b = e.target.closest('.sheet__frame'); if (b && b !== playing) playFrame(b); });
  film.addEventListener('pointerleave', () => { stopFrame(playing); playing = null; });
}
mm.add({ motion: '(prefers-reduced-motion: no-preference)' }, () => {
  gsap.from('.sheet__frame', { y: 40, opacity: 0, rotate: () => gsap.utils.random(-2, 2), duration: 0.9, ease: 'power3.out', stagger: { each: 0.05, from: 'random' }, scrollTrigger: { trigger: '#sheetFilm', start: 'top 80%' } });
  gsap.utils.toArray('.sheet__circle path').forEach(p => { const L = p.getTotalLength(); gsap.fromTo(p, { strokeDasharray: L, strokeDashoffset: L }, { strokeDashoffset: 0, duration: 1.1, ease: 'power2.inOut', scrollTrigger: { trigger: p, start: 'top 75%' } }); });
  gsap.from('.sheet__head > *', { y: 30, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.08, scrollTrigger: { trigger: '#bts', start: 'top 75%' } });
});

const brief = { city: '', kind: '', mood: '', when: '' };

/* ---------- got a vision: a camera screen in four steps, the shutter sends it ---------- */
// live view: what shows behind the menu as they pick
const KIND_VIEW = { 'bridal couture': ['elysian-queen', 3], 'fashion campaign': ['rouge', 5], lookbook: ['indian-fashion', 4], menswear: ['the-art-of-being', 4], portrait: ['forever-in-bloom', 3], photo: ['the-weight-of-grace', 3] };
const MOODS = [['white-symphony', 3], ['rouge', 3], ['the-living-canvas', 3], ['the-language-of-form', 4], ['the-art-of-luxury', 3], ['indian-reverie', 4]];
$('#moodPick').innerHTML = MOODS.map(([m, n]) => `<button type="button" data-v="${m}" data-n="${n}"><img src="${shot(m, n, 800)}" alt="" loading="lazy"><span>${bySlug(m).title}</span></button>`).join('');
$('#cityPick').innerHTML = CITIES.map(c => `<button type="button" class="city" role="listitem" data-v="${c.id}">${c.svg}<span class="city__name">${c.id}</span></button>`).join('');
const now = new Date(), MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const FULL = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const months = Array.from({ length: 6 }, (_, k) => { const d = new Date(now.getFullYear(), now.getMonth() + k, 1); return d.getFullYear() === now.getFullYear() ? MON[d.getMonth()] : `${MON[d.getMonth()]} ${d.getFullYear()}`; });
$('#whenChips').innerHTML = [...months, 'Not sure yet'].map(m => `<button type="button" data-v="${m}">${m}</button>`).join('');
const live = $('#camLive');
const setLive = (slug, n) => {
  const src = shot(slug, n); if (live.dataset.src === src) return; live.dataset.src = src;
  if (reduce) { live.src = src; live.classList.add('is-on'); return; }
  gsap.to(live, { opacity: 0, duration: 0.2, onComplete: () => { live.src = src; live.onload = () => gsap.to(live, { opacity: 1, duration: 0.6 }); } });
};
let step = 1;
const LAST = 4;
const camSteps = [...document.querySelectorAll('.cam__step')], dots = [...document.querySelectorAll('#camDots i')];
const camForm = $('#camForm');
const ready = () => step === 1 ? !!brief.kind : step === 2 ? !!brief.mood : step === 3 ? !!brief.city : !!camForm.name.value.trim();
const HINTS = { 1: '', 2: '', 3: '', 4: 'Add your name to send' };
const paint = () => {
  camSteps.forEach(s => s.classList.toggle('is-on', +s.dataset.step === step));
  dots.forEach((d, i) => d.classList.toggle('is-on', i < step));
  $('#camShutterLabel').textContent = step === LAST ? 'Send it' : 'Next';
  $('#camBack').style.visibility = step > 1 ? 'visible' : 'hidden';
  $('#camHint').textContent = ready() ? (step === LAST ? 'Opens WhatsApp' : '') : HINTS[step];
  $('#camShutter').classList.toggle('is-ready', ready());
};
const pickIn = (sel, key, after) => $(sel).addEventListener('click', (e) => {
  const b = e.target.closest('button'); if (!b) return;
  brief[key] = b.dataset.v; $(sel).querySelectorAll('button').forEach(x => x.classList.toggle('is-on', x === b));
  after && after(b); paint();
});
pickIn('#kindChips', 'kind', (b) => { const [s, n] = KIND_VIEW[b.dataset.v]; setLive(s, n); });
pickIn('#moodPick', 'mood', (b) => setLive(b.dataset.v, +b.dataset.n));
pickIn('#cityPick', 'city', (b) => { $('#camLoc').textContent = b.dataset.v.toUpperCase(); if (!reduce) gsap.fromTo(b.querySelector('svg'), { scale: 0.8 }, { scale: 1, duration: 0.6, ease: 'back.out(3)' }); });
pickIn('#whenChips', 'when');
camForm.addEventListener('input', paint);
camForm.addEventListener('submit', (e) => { e.preventDefault(); shoot(); });
$('#camBack').addEventListener('click', () => { if (step > 1) { step--; paint(); } });
function shoot() {
  if (!ready()) { if (!reduce) gsap.fromTo('#camShutter', { x: -6 }, { x: 0, duration: 0.4, ease: 'elastic.out(1,0.3)' }); return; }
  if (step < LAST) {
    if (!reduce) gsap.fromTo('#camScreen .cam__steps', { opacity: 0.2 }, { opacity: 1, duration: 0.4 });
    step++; paint(); return;
  }
  const f = new FormData(camForm), name = f.get('name').trim(), brand = f.get('brand').trim();
  const where = brief.city === 'Abroad' ? ' abroad' : brief.city === 'The hills' ? ' in the hills' : brief.city ? ' in ' + brief.city : '';
  const when = brief.when && brief.when !== 'Not sure yet' ? `, around ${FULL[MON.indexOf(brief.when.slice(0, 3))]}${brief.when.length > 3 ? brief.when.slice(3) : ''}` : '';
  const msg = `Hi Bhupendra, I'm ${name}${brand ? ' from ' + brand : ''}. I'm planning a ${brief.kind} shoot${where}${when}. The mood I have in mind is close to your ${bySlug(brief.mood).title} shoot.`;
  logLead('camera', { message: msg, name, brand, kind: brief.kind, mood: brief.mood, city: brief.city, when: brief.when });
  const go = () => { const a = document.createElement('a'); a.href = wa(msg); a.target = '_blank'; a.rel = 'noopener'; a.dataset.logged = '1'; document.body.appendChild(a); a.click(); a.remove(); };
  if (reduce) return go();
  gsap.timeline().to('#camShutter .cam__shutter-ring', { scale: 0.86, duration: 0.08 }).to('#camShutter .cam__shutter-ring', { scale: 1, duration: 0.3, ease: 'back.out(3)' })
    .fromTo('#camFlash', { opacity: 1 }, { opacity: 0, duration: 0.7, ease: 'power2.out' }, 0.05).add(go, 0.25);
}
$('#camShutter').addEventListener('click', shoot);
paint();
// every shutter press uses a frame, like a roll
let shots = 36;
$('#camShutter').addEventListener('click', () => { if (ready() && shots > 1) $('#camShots').textContent = String(--shots).padStart(2, '0'); });
// the camera tilts toward the pointer
const cam = $('#cam .cam__body');
if (matchMedia('(hover: hover) and (pointer: fine)').matches && !reduce) {
  const rx = gsap.quickTo(cam, 'rotationX', { duration: 0.8, ease: 'power3' }), ry = gsap.quickTo(cam, 'rotationY', { duration: 0.8, ease: 'power3' });
  $('#frame').addEventListener('pointermove', (e) => { const r = $('#cam').getBoundingClientRect(); ry(((e.clientX - r.left) / r.width - 0.5) * 10); rx(-((e.clientY - r.top) / r.height - 0.5) * 8); });
  $('#frame').addEventListener('pointerleave', () => { rx(0); ry(0); });
}
mm.add({ motion: '(prefers-reduced-motion: no-preference)' }, () => {
  gsap.from('.frame__head > *', { y: 30, opacity: 0, duration: 1, ease: 'power3.out', stagger: 0.08, scrollTrigger: { trigger: '#frame', start: 'top 75%' } });
  gsap.from('.cam__body', { rotationX: 28, y: 80, opacity: 0, duration: 1.3, ease: 'power3.out', scrollTrigger: { trigger: '#cam', start: 'top 85%' } });
  gsap.from('.foot__strip > *, .foot__links a', { y: 20, opacity: 0, duration: 0.8, stagger: 0.06, ease: 'power3.out', scrollTrigger: { trigger: '.foot', start: 'top 92%' } });
});
// the floating pill and the viewer chips are just other doors to the same WhatsApp
ScrollTrigger.create({ trigger: '#frame', start: 'top 70%', end: 'bottom 30%', onToggle: (st) => $('#waFloat').classList.toggle('is-hid', st.isActive) });
