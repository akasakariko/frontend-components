
const $ = s => document.querySelector(s);
const scene = $('#scene'), pack = $('#pack'), flap = $('#flap'), hit = $('#hit'), ground = $('#ground'), again = $('#again'), live = $('#live');
const body = [...pack.querySelectorAll(':scope > .skin')], bodyLip = pack.querySelector('.lips .lip');
const boxOf = ([l, t, w]) => `left:${l}%;top:${t}%;width:${w}%`;
const rig = ({ body, eyes, mouth, joy }) => `<img class="body" src="${body}" alt="">${eyes.map(e => `<i class="eye" style="${boxOf(e)}"><img class="pupil" src="${e[3]}" alt=""></i>`).join('')}<img class="smile" style="${boxOf(mouth)}" src="${mouth[3]}" alt="">${joy ? `<img class="joy" style="${boxOf(joy)}" src="${joy[3]}" alt="">` : ''}`;
const blink = (list, times = 1) => { for (const e of list) e.animate([{ scale: '1 1' }, { scale: '1 .08' }, { scale: '1 1' }], { duration: 170, iterations: times, easing: 'cubic-bezier(.77,0,.175,1)' }); };
pack.querySelector('.orb').insertAdjacentHTML('afterbegin', `<img class="shade" src="${ART.sparkle.body}" alt="">` + rig(ART.sparkle) + ['ouch', 'drip'].map(k => { const a = ART.sparkle[k === 'drip' ? 'sweat' : k]; return `<img class="${k}" style="${boxOf(a)}" src="${a[3]}" alt="">`; }).join(''));
// every picture is decoded up front and held on to, so a card has its art on the very first frame it exists
const warm = Object.values(ART).flatMap(a => [a.body, ...a.eyes.map(e => e[3]), a.mouth[3], ...(a.joy ? [a.joy[3]] : [])]).map(src => { const i = new Image(); i.src = src; i.decode().catch(() => {}); return i; });
const eyes = [...pack.querySelectorAll('.eye')], pupils = [...pack.querySelectorAll('.pupil')], edition = pack.querySelector('.series');
const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
const handheld = matchMedia('(pointer: coarse)').matches;   // phones and tablets: the same show with the costly invisible parts taken out
const clamp = (v, a, b) => Math.min(b, Math.max(a, v)), rand = (a, b) => a + Math.random() * (b - a);

/* ---------- cards in the pack, front of the stack first ---------- */
const DATA = [
  { name: 'Blip', type: 'Spark', no: '014', tier: 'common', label: 'Common', mark: '●' },
  { name: 'Cubit', type: 'Block', no: '027', tier: 'common', label: 'Common', mark: '●' },
  { name: 'Facet', type: 'Prism', no: '063', tier: 'rare', label: 'Rare', mark: '◆' },
  { name: 'Ringo', type: 'Orbit', no: '088', tier: 'rare', label: 'Holo rare', mark: '◆◆' },
  { name: 'Nova', type: 'Star', no: '120', tier: 'ultra', label: 'Ultra rare', mark: '★' },
];
/* every pack is its own: colourway, the shapes of its light and shade, tear line and the order of the cards inside */
const SKINS = [['Cobalt', '#2b3ff0'], ['Ember', '#f0542c'], ['Grape', '#7a42f0'], ['Pine', '#0e9c79'], ['Night', '#23273d'], ['Bubblegum', '#ec4f9a']];
/* light and shade, drawn fresh for every pack in % of the pouch. the shine under the top seal is broken into streaks by the wrinkles
   where the foil gathers into the seal, each fading as it runs down; it reaches just past the tear line so the torn edge keeps a glint.
   the shade is a soft, crumpled shadow where the foil tucks into the bottom seal */
const svg = s => `url("data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100' preserveAspectRatio='none'>${s}</svg>")`;
function light(st) {
  const f = n => n.toFixed(2);
  let lit = '', dark = 'M0 93.2V91.6';
  for (let x = 0; x < 100;) {   // soft creases where the foil gathers into the seal: each a thin streak of light fading out as it runs down
    const w = rand(.5, 2.6);
    lit += `<rect x='${f(x)}' y='6.8' width='${f(w)}' height='${f(rand(3.2, 8.5))}' fill='url(%23g)' fill-opacity='${f(rand(.08, .42))}'/>`;
    x += w + rand(0, 1.4);
  }
  for (let x = 0; x < 100;) {   // rounded humps of crumpled foil
    const w = rand(2.5, 7), peak = x + w * rand(.35, .65);
    x = Math.min(100, x + w); dark += `Q${f(peak)} ${f(rand(86.6, 90))} ${f(x)} ${f(rand(91.1, 91.7))}`;
  }
  st.setProperty('--shine', svg(`<linearGradient id='g' x2='0' y2='1'><stop stop-color='%23fff' stop-opacity='.7'/><stop offset='1' stop-color='%23fff' stop-opacity='0'/></linearGradient><filter id='b'><feGaussianBlur stdDeviation='.28 .5'/></filter><g filter='url(%23b)'>${lit}</g>`));
  st.setProperty('--shade', svg(`<filter id='b'><feGaussianBlur stdDeviation='.35 .24'/></filter><path d='${dark}V93.2Z' fill-opacity='.1' filter='url(%23b)'/>`));
}
const shuffle = a => { for (let i = a.length; i > 1;) { const j = Math.random() * i-- | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const cardHTML = d => `<i class="slab"></i><i class="slab"></i><i class="slab"></i><div class="face"><div class="win"><i class="drop"></i></div><b class="name">${d.name}</b><span class="type">${d.type}</span><i class="rule"></i><span class="no">No. ${d.no}/120</span><span class="rar">${d.mark} ${d.label}</span><i class="holo"></i><i class="glare"></i><i class="glaze"></i></div><div class="pop">${rig(ART[d.name.toLowerCase()])}</div>`;

/* ---------- springs, SwiftUI's (response, bounce) mapping ---------- */
class Spring {
  constructor(x, response = .5, bounce = 0) { this.x = this.to = x; this.v = 0; this.set(response, bounce); }
  set(response, bounce = 0) { this.k = (2 * Math.PI / response) ** 2; this.c = 4 * Math.PI * (1 - bounce) / response; return this; }
  step(h) { this.v += (this.k * (this.to - this.x) - this.c * this.v) * h; this.x += this.v * h; }
}
const pose = (o, response, bounce) => { for (const k in o) o[k] = new Spring(o[k], response, bounce); return o; };

const TEAR = 10.5, N = 96, K = handheld ? 8 : 12, Y_MIN = 8, Y_MAX = 19.5;   // tear lines sit around 10.5% of the pouch height, somewhere between these two, in 96 ragged segments; the strip bends in 12 slices
const P = pose({ x: 0, y: 0, rx: 0, ry: 0, rz: 0 }, .7, .28);
const eye = pose({ x: 0, y: 0 }, .18, .3);
const tear = { p: new Spring(0, .1), th: new Spring(0, .28, .35), ph: new Spring(0, .3, .2), dir: 1, last: 0, vx: 0 };
const squeeze = new Spring(0, .3, .45), glow = new Spring(0, .5);   // the clench while it is torn; the flow showing
const rays = $('#rays'), flow = $('#flow');
let anchor = { y: 0, rz: 0 };   // where the pack last held the flow
const pointer = { x: innerWidth / 2, y: innerHeight / 2, in: false };
let state, settle, jag, fall, fly, drag, wasDrag = false, viaKey = false, cards = [], bits = [], spreadAt = 0;
let calm = false, t = 0, last = performance.now(), openedAt = 0, blinkAt = 2.5, nudgeAt = 5, PW, PH, skin;
const fx = $('#fx'), fxc = fx.getContext('2d'), BIT = [new Path2D(), new Path2D(), new Path2D('M0-6 1.3-1.3 6 0 1.3 1.3 0 6-1.3 1.3-6 0-1.3-1.3Z')];   // a dot, a strip, a sparkle
BIT[0].arc(0, 0, 4.5, 0, 7); BIT[1].roundRect(-3.5, -6, 7, 12, 2);
let fxUsed = false;
const measure = () => { PW = pack.offsetWidth; PH = pack.offsetHeight; const d = Math.min(handheld ? 1.5 : 2, devicePixelRatio); fx.width = innerWidth * d; fx.height = innerHeight * d; };

function enter() {
  state = 'enter';
  const pool = SKINS.filter(s => s !== skin), st = pack.style;   // never the same colourway twice in a row
  skin = pool[rand(0, pool.length) | 0]; edition.textContent = skin[0];
  st.setProperty('--pack', skin[1]); light(st);
  path();
  for (const s of body) s.style.clipPath = '';
  bodyLip.style.clipPath = ''; for (const s of plies) { s.el.hidden = true; s.done = false; s.el.style.transform = ''; } for (const r of rims) r.el.style.top = r.top + '%';
  flap.className = 'flap'; flap.style.transform = ''; rays.style.cssText = ''; pack.style.visibility = flow.style.visibility = ''; pack.classList.remove('held', 'hurt', 'tug'); scene.classList.remove('flat');
  sprout(); if (!reduce) { load(); sfx?.arrive(); }
  hit.disabled = false;
  fall = fly = drag = null; spreadAt = 0; tear.last = 0; tear.dir = 1;
  for (const s of [tear.p, tear.th, tear.ph, squeeze, glow, ...Object.values(P)]) s.x = s.to = s.v = 0;
  for (const s of Object.values(P)) s.set(.7, .28);
  if (!reduce) Object.assign(P.x, { x: innerWidth * .62 }), P.y.x = -50, P.ry.x = -200, P.rz.x = 16;   // flies in from the right, spinning round to its front
  settle = setTimeout(() => state = 'idle', reduce ? 0 : 950);
}

/* ---------- tearing ---------- */
/* every tear is its own: how far it climbs or dives across the pack, whether it bows or wanders, where it snags. each point is [x, y, the line's own height,
   its fine tooth, how much bright metal shows there, how far the hand has bent it], all in % of the pouch */
const place = (q, bend) => { q[5] = bend; q[1] = clamp(q[2] + bend, Y_MIN, Y_MAX) + q[3]; };
function path() {
  tear.roll = rand(.65, 1.4);   // and how tightly this strip curls
  const slope = rand(-7.5, 7.5), bow = rand(-3, 3), freq = rand(1.5, 3.5), ph = rand(0, 6.28), wob = rand(.3, 1.1), y0 = rand(10.5, 14);
  let walk = 0;
  jag = Array.from({ length: N + 1 }, (_, i) => {
    const x = i / N * 100, s = x / 50 - 1;
    walk = clamp(walk + rand(-.25, .25) + (Math.random() < .05 ? rand(-1.5, 1.5) : 0), -2.2, 2.2);   // it wanders, and now and then it snags and jumps
    const q = [i && i < N ? x + rand(-.3, .3) : x, 0, y0 + slope * s + bow * (1 - s * s) + wob * Math.sin(s * freq * Math.PI + ph) + walk, rand(-.42, .42) + (Math.random() < .14 ? rand(-1.2, 1.2) : 0), Math.random() < .12 ? rand(1.2, 2.1) : rand(.35, 1.1), 0];
    place(q, 0); return q;
  });
}
// the part not torn yet follows the hand: pull down and it dives, pull up and it climbs. what is already torn stays as it was
function steer(k) {
  const d = tear.dir, i0 = clamp(Math.round((d > 0 ? tear.p.x : 1 - tear.p.x) * N), 0, N);
  for (let i = i0 + d; i >= 0 && i <= N; i += d) place(jag[i], jag[i0][5] + k * Math.abs(i - i0) * 100 / N);
}
const yAt = x => { const f = clamp(x, 0, 100) / 100 * N, i = Math.min(N - 1, f | 0); return jag[i][1] + (jag[i + 1][1] - jag[i][1]) * (f - i); };
const poly = a => `polygon(${a.map(([x, y]) => `${(+x).toFixed(2)}% ${(+y).toFixed(2)}%`).join(',')})`;
const mirror = a => a.map(([x, y]) => [100 - x, y]);   // back faces are turned 180deg, so their x runs the other way
const band = (a, sign) => [...a, ...a.slice().reverse().map(q => [q[0], q[1] + sign * q[4]])];   // a thin strip along a torn edge, as wide as the metal showing at each point
const plies = Array.from({ length: K }, () => {
  const el = document.createElement('div');
  el.className = 'ply'; el.hidden = true;
  el.innerHTML = '<div class="skin front"><span class="tag">Tear here ⟶</span><i class="lip"></i><i class="tone"></i></div><div class="skin foil"><i class="tone"></i></div>';
  flap.append(el);
  const [front, foil] = el.children;
  return { el, front, foil, lip: front.querySelector('.lip'), shade: front.querySelector('.tone'), under: foil.querySelector('.tone'), done: false };
});
function clips(p) {
  const d = tear.dir, xt = d > 0 ? p * 100 : 100 - p * 100, yt = yAt(xt), tip = [xt, yt, 0, 0, 0];
  const torn = jag.filter(([x]) => d > 0 ? x < xt : x > xt);
  const rest = d > 0 ? [[xt, 0], [100, 0], [100, 100], [0, 100], ...torn, [xt, yt]] : [[0, 0], [xt, 0], [xt, yt], ...torn, [100, 100], [0, 100]];
  body[0].style.clipPath = poly(rest); body[1].style.clipPath = poly(mirror(rest));
  bodyLip.style.clipPath = poly(band(d > 0 ? [...torn, tip] : [tip, ...torn], 1));
  for (const r of rims) { const side = r.s > 0 ? 100 : 0; if (d > 0 ? side <= xt : side >= xt) r.el.style.top = Math.max(r.top, yAt(side) + 1.4).toFixed(2) + '%'; }   // the rounded side is torn away with it
  flap.style.transformOrigin = `${xt}% ${yt}%`;   // the loose end hinges on the tip of the tear
  const w = 100 / K, lap = .25;
  plies.forEach((s, k) => {   // each slice of the strip is cut out once the tear has gone past it
    const lo = d > 0 ? k * w : Math.max(k * w, xt), hi = d > 0 ? Math.min((k + 1) * w, xt) : (k + 1) * w;
    if (hi <= lo) { s.el.hidden = true; return; }
    s.el.hidden = false;
    if (s.done) return;
    const L = d < 0 && lo === xt ? lo : Math.max(0, lo - lap), R = d > 0 && hi === xt ? hi : Math.min(100, hi + lap);
    const span = [[L, yAt(L), 0, 0, .8], ...jag.filter(q => q[0] > L && q[0] < R), [R, yAt(R), 0, 0, .8]], piece = [[L, 0], [R, 0], ...span.slice().reverse()];
    s.front.style.clipPath = poly(piece); s.foil.style.clipPath = poly(mirror(piece)); s.lip.style.clipPath = poly(band(span, -1));
    s.done = d > 0 ? hi < xt || xt >= 100 : lo > xt || xt <= 0;
  });
  // going out from the tip each hinge bends further than the last, and the longer the strip the tighter it rolls
  const k0 = clamp(Math.floor((d > 0 ? xt - 1e-6 : xt) / w), 0, K - 1), bend = (2.6 + 2.6 * p) * tear.roll, jit = Math.min(1, Math.abs(tear.p.v) * .4) * 1.6;
  let m = '', sum = 0;
  for (let n = 0, k = k0; k >= 0 && k < K; n++, k -= d) {
    const x = ((n ? (d > 0 ? k + 1 : k) * w : xt) / 100 * PW).toFixed(2), a = d * (bend * (.4 + .3 * n) + Math.sin(t * 16 + n * .9) * jit), s = plies[k];
    sum += a; m += `translateX(${x}px) rotateY(${a.toFixed(2)}deg) rotateZ(${(d * .9 * n / 4).toFixed(2)}deg) translateX(-${x}px) `;
    s.el.style.transform = m; s.shade.style.opacity = Math.min(.5, Math.abs(sum) / 200).toFixed(2); s.under.style.opacity = Math.max(0, .34 - Math.abs(sum) / 420).toFixed(2);
  }
}
function start() { if (!pack.classList.contains('hurt')) sfx?.eep(); flap.classList.add('on'); pack.classList.remove('tug'); pack.classList.add('held', 'hurt'); }
function finish(response) { tear.p.set(response); tear.p.to = 1; tear.th.to = rand(14, 30); tear.ph.to = -rand(20, 44); }

hit.addEventListener('pointerdown', e => {
  viaKey = false;
  if (e.button || drag) return;   // the main button and the first finger only
  if (state === 'enter') {   // grabbed out of the air: it stops flying and it's yours
    clearTimeout(settle); state = 'idle'; squeeze.v -= 6;
    for (const s of Object.values(P)) s.set(.28, .25);
  }
  if (state !== 'idle') return;
  hit.setPointerCapture(e.pointerId); sfx?.grab();
  drag = { id: e.pointerId, x0: e.clientX, y0: e.clientY, p0: tear.p.to, moved: false, lx: e.clientX, lt: e.timeStamp };
});
hit.addEventListener('pointermove', e => {
  if (e.pointerId !== drag?.id || state !== 'idle') return;
  if (e.pointerType === 'mouse' && !e.buttons) return letGo(e);   // the button came up somewhere this page never heard about
  const dx = e.clientX - drag.x0;
  let dy = e.clientY - drag.y0;
  if (!drag.moved) {
    if (Math.hypot(dx, dy) < 6) return;
    drag.moved = true; tear.p.set(.1); pack.classList.add('tug');
  }
  if (tear.p.to === 0) {   // nothing tears until the hand really goes sideways, and only then is the side chosen. until that it is just a tug on the pack
    drag.dy = dy;
    if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * .5) return;
    tear.dir = dx < 0 ? -1 : 1; drag.y0 = e.clientY; dy = 0;
  }
  start();
  tear.p.to = clamp(drag.p0 + (drag.p0 ? Math.abs(dx) : dx * tear.dir) / (PW * .85), tear.p.to, 1);   // a tear only moves forward, but a strip already started follows the hand whichever way it pulls
  tear.th.to = 6 + tear.p.to * 14 + clamp(-dy * .16, -6, 22);
  tear.ph.to = -(8 + tear.p.to * 22) - clamp(-dy * .2, 0, 24);
  tear.vx = (e.clientX - drag.lx) / Math.max(8, e.timeStamp - drag.lt) * 1000; drag.lx = e.clientX; drag.lt = e.timeStamp;
  drag.k = (drag.k || 0) + (clamp(dy / Math.max(60, Math.abs(dx)), -.7, .7) * PW / PH - (drag.k || 0)) * .3; steer(drag.k);
});
const letGo = e => {
  if (!drag || (e.pointerId !== undefined && e.pointerId !== drag.id)) return;
  wasDrag = drag.moved; drag = null;
  if (!wasDrag || state !== 'idle') return;
  if (tear.p.to > .55) return finish(.18);
  sfx?.[pack.classList.contains('hurt') ? 'phew' : 'boing']();
  pack.classList.remove('held', 'hurt', 'tug'); tear.th.to = 3 + tear.p.to * 10; tear.ph.to = -tear.p.to * 14;   // flap relaxes and stays half torn; the character comes back to rest
};
for (const type of ['pointerup', 'pointercancel', 'lostpointercapture']) hit.addEventListener(type, letGo);
hit.addEventListener('click', e => {
  if (wasDrag && e.detail) return wasDrag = false;
  if (state !== 'idle') return;
  viaKey = e.detail === 0;
  if (!tear.p.to) tear.dir = Math.random() < .5 ? -1 : 1;   // a press tears it for you, from either side
  start(); finish(tear.p.to ? .18 : .55);   // press it again, or press one already half torn, and it rips the rest of the way, fast, the way it was going
});

function open() {
  if (drag && hit.hasPointerCapture(drag.id)) hit.releasePointerCapture(drag.id);   // a disabled button never gets the pointerup, so it would hold the pointer forever
  state = 'open'; openedAt = t; drag = null;
  tear.p.x = tear.p.to = 1; clips(1);
  hit.disabled = true;   // the face keeps wincing as it falls away
  live.textContent = `${skin[0]} pack opened: ${DATA.map(d => d.name).join(', ')}.`;   // the colourway never repeats, so a screen reader announces every pack
  P.rx.set(.3); P.ry.set(.3); P.rx.to = P.ry.to = 0;   // level out so the cards slide out square
  if (reduce) { pack.style.visibility = flow.style.visibility = 'hidden'; flap.className = 'flap'; }
  else {
    fly = { x: 0, y: 0, vx: tear.dir * 240, vy: -1900, th: tear.th.x, vth: 520, ph: tear.ph.x, vph: -320 };
    P.y.v += 320; P.rz.v -= tear.dir * 40;   // recoil
    burst();
  }
  spawn();
  sfx?.rip(0); sfx?.pop(!reduce);
  if (reduce) for (const c of cards) sfx?.land(c.d.name.toLowerCase(), c.slot);
}

/* ---------- cards ---------- */
// the deck unwinds: the cards spiral out around the middle of the screen and orbit it, facing you, and then the ring opens out into the row
const ORBIT = 1.25, ease = (a, b, x) => { const k = clamp((x - a) / (b - a), 0, 1); return k * k * (3 - 2 * k); };
function unwind() {
  spreadAt = t; scene.classList.add('flat'); sfx?.swirl(ORBIT);
  for (const c of cards) {
    const p = c.p, f = c.f = fan(c);
    Object.assign(c, { phase: 'orbit', from: t + c.i * .03, x0: p.x.x, y0: p.y.x, vy: p.y.v, rz0: p.rz.x, even: -c.slot * 2 * Math.PI / cards.length, end: Math.PI / 2 - (c.slot - (cards.length - 1) / 2) * .55 });
    c.landAt = c.from + ORBIT; p.s.to = f.s;
    for (const k in p) if (k !== 's') p[k].k = p[k].c = p[k].v = 0;   // from here its path is a pure function of time
  }
}
function orbit(c) {
  const p = c.p, f = c.f, u = clamp((t - c.from) / ORBIT, 0, 1), turn = 1 - (1 - u) ** 2, out = ease(.52, 1, u), ring = Math.sin(Math.min(1, u / .42) * Math.PI / 2) * (1 - out);
  const a = c.end + (1 - turn) * (c.even - c.end + Math.PI * 2.5), sin = Math.sin(a), cos = Math.cos(a), W = Math.min(innerWidth * .33, 430), mid = c.y0 + c.vy / 9 * (1 - Math.exp(-9 * Math.max(0, t - c.from)));
  const cy = mid + (-innerHeight * .03 - mid) * ease(0, .42, u);
  p.x.x = c.x0 * (1 - out) + f.x * out + cos * W * ring;
  p.y.x = cy * (1 - out) + f.y * out + sin * W * .2 * ring;
  p.z.x = f.z * out + sin * 300 * ring;
  p.rz.x = c.rz0 * (1 - out) + f.rz * out - cos * 8 * ring; p.ry.x = -cos * 26 * ring; p.rx.x = 7 * ring;
  if (u === 1) { c.phase = 'spread'; c.el.classList.add('out'); for (const k in p) p[k].set(.5, .22); sfx?.land(c.d.name.toLowerCase(), c.slot); }
}
function fan(c) {
  const n = cards.length, m = c.slot - (n - 1) / 2, cw = c.el.offsetWidth, vw = innerWidth;
  if (innerHeight > vw * 1.15) {   // a tall screen has height to spare and no width: two up, one in the middle, two down, as if tossed on a table, big enough that every character shows
    const w = Math.min((vw - 34) / 2, (innerHeight - 150) / 2.72 / 1.4, cw), [X, Y, rz] = [[-1, -1, -4], [1, -1, 4], [0, 0, 0], [-1, 1, 3], [1, 1, -3]][c.slot];
    return { x: X * (w / 2 + 5), y: -15 + Y * w * 1.4 * .86, z: X || Y ? 0 : 40, rz, s: w / cw };
  }
  const s = clamp((vw - 48) / (cw * (1 + (n - 1) * 1.08)), .6, 1), w = cw * s, side = Math.min(w * 1.08, (vw - 40 - w) / (n - 1)), tight = side < w, ends = (n - 1) / 2, lean = ends * 7 * Math.PI / 180, near = 1400 / (1400 - ends * 40);
  // the end cards of a tight fan lean over and sit nearer you, so their corners reach further out than their width: draw the fan in until they stay on screen
  const gap = tight ? Math.max(6, Math.min(side, (vw / 2 - 8 - (w / 2 * Math.cos(lean) + w * .7 * Math.sin(lean)) * near) / (ends * near))) : side;
  // side by side with clear gaps when there is room; on narrow screens overlap like a hand of cards, each over the last so every name shows
  return { x: m * gap, y: -innerHeight * .03 + m * m * (tight ? 9 : 5) * s, z: tight ? m * 40 : 0, rz: m * (tight ? 7 : 2), s };
}
// which card the pointer is on, worked out from where the cards rest and not from where they have got to: a lifted, tilted card can't slide out from
// under the pointer and flicker, and on a tight fan every sliver showing is its own key, so a finger can strum along the row
function aimed() {
  let best = null;
  for (const c of cards) {
    if (c.phase !== 'spread') continue;
    const f = c.f, near = 1400 / (1400 - f.z), a = f.rz * Math.PI / 180, cos = Math.cos(a), sin = Math.sin(a), w = PW * .84 * f.s * near, h = w * 1.4;
    const dx = pointer.x - (innerWidth / 2 + f.x * near), dy = pointer.y - (innerHeight * .4 + (innerHeight * .1 + f.y) * near), hx = (dx * cos + dy * sin) / w + .5, hy = (dy * cos - dx * sin) / h + .5;
    if (hx >= 0 && hx <= 1 && hy >= 0 && hy <= 1 && (!best || f.z >= best.f.z)) { best = c; c.hx = hx; c.hy = hy; }
  }
  return best;
}
function spawn() {
  // a new stack order every pack. it fans out in that order, the front card sliding off to the right first and each one under it
  // following, so the cards keep their stacking all the way out and never pass through each other
  cards = shuffle([...DATA]).map((d, i) => {
    const el = document.createElement('div');
    el.className = `card ${d.tier} ${d.name.toLowerCase()}`; el.innerHTML = cardHTML(d);
    el.setAttribute('role', 'img'); el.setAttribute('aria-label', `${d.name}, ${d.label}, number ${d.no}`);
    el.style.zIndex = DATA.length - i;
    scene.append(el);
    const c = { el, d, i, slot: DATA.length - 1 - i, face: el.querySelector('.face'), eyes: [...el.querySelectorAll('.eye')], blinkAt: t + rand(.6, 3.2), phase: 'in', hover: false, hx: .5, hy: .5,
      p: pose({ x: P.x.x, y: P.y.x + PH * ((Math.max(...jag.map(q => q[1])) + .8 + 38.2) / 100 - .5), z: 3.5 - i * 1.75, rx: 0, ry: 0, rz: P.rz.x, s: .94 }, .55, .22) };
    el.tabIndex = 0;   // the keyboard visits them too: picked, a card lifts and smiles just as it does under the pointer
    el.addEventListener('focus', () => c.kb = el.matches(':focus-visible'));
    el.addEventListener('blur', () => c.kb = false);
    return c;
  });
  for (const c of cards.slice().reverse()) scene.append(c.el);   // tab order runs along the row, left to right. what is drawn over what is set by depth and z-index
  if (reduce) for (const c of cards) { c.phase = 'spread'; c.f = fan(c); c.el.classList.add('out'); for (const k in c.f) c.p[k].x = c.p[k].to = c.f[k]; }
}

// the pieces are made while the pack is whole and only set off at the tear, so the tear itself has no work to do
function load() { for (let i = 0; i < (handheld ? 130 : 240); i++) bits.push({ kind: i % 3, fill: [...BANDS, '#fff'][i % 8] }); }
// they start down inside the pouch, between the cards and the front of the foil, and are blown up and out through the opening: straight up inside, spreading only once
// they are free of the mouth. most are slow and floaty once out: vt is how fast that piece can fall through the air
function burst() {
  bits.forEach((b, i) => {
    if (b.age !== undefined) return;   // still coming down from the last pack
    const lx = rand(6, 94), vt = 260 + 400 * Math.random() ** 1.5;
    Object.assign(b, { inside: true, lx, ly: yAt(lx) + rand(1, 16), lz: rand(4.6, 7), up: rand(900, 2600), a: ((lx - 50) / 50 + rand(-.5, .5)) * clamp(innerWidth / 1000, .5, 1), sp: rand(500, 2700), r: rand(0, 360), spin: rand(-700, 700), c: 2600 / vt / vt, slip: rand(900, 2600), glide: Math.sign(lx - 50) * rand(-200, 900), sc: rand(.9, 1.9), ph: rand(0, 6.28), age: i < 50 ? 0 : -rand(0, .22) });
    b.x = b.y = b.z = 0;
  });
}
// a point in the pack, in % of the pouch across and down and px through it, to where it is on the stage
function onStage(lx, ly, lz) {
  const R = Math.PI / 180, cx = Math.cos(P.rx.x * R), sx = Math.sin(P.rx.x * R), cy = Math.cos(P.ry.x * R), sy = Math.sin(P.ry.x * R), cz = Math.cos(P.rz.x * R), sz = Math.sin(P.rz.x * R);
  const x0 = (lx - 50) / 100 * PW, y0 = (ly - 50) / 100 * PH, x1 = x0 * cz - y0 * sz, y1 = x0 * sz + y0 * cz, x2 = x1 * cy + lz * sy, z2 = -x1 * sy + lz * cy;
  return [x2 + P.x.x, y1 * cx - z2 * sx + P.y.x + (fall ? fall.y : 0), y1 * sx + z2 * cx];
}

/* ---------- frame ---------- */
function frame(now) {
  if (handheld && now - last < (calm ? 30 : 14)) return requestAnimationFrame(frame);   // phones: at most 60 updates a second even on a 120Hz screen, and 30 while all that's happening is a gentle bob
  const dt = Math.min(.05, (now - last) / 1000); last = now; t += dt;
  const motion = reduce ? 0 : 1, held = pack.classList.contains('held');
  const tug = motion && drag?.moved && !tear.p.to ? Math.sign(drag.dy) * 170 * (1 - 1 / (1 + Math.abs(drag.dy) / 170)) : 0;   // pulled up or down instead of across, it stretches after the hand and boings back when let go
  squeeze.to = tug ? -Math.abs(tug) / 90 : held && state === 'idle' ? motion : 0;   // clenches like someone holding their pain, lets go once it rips

  if (state === 'enter' || state === 'idle') {
    const hold = drag?.moved ? .25 : 1, tilt = hold * (reduce ? .5 : 1);
    const nx = pointer.in ? clamp(pointer.x / innerWidth * 2 - 1, -1, 1) : 0, ny = pointer.in ? clamp(pointer.y / innerHeight * 2 - 1, -1, 1) : 0;
    P.y.to = Math.sin(t * 1.4) * 7 * motion + tug;
    P.ry.to = nx * 22 * tilt; P.rx.to = -ny * 16 * tilt - squeeze.x * 6;   // turns to face the pointer; curls its top in while it hurts
    P.rz.to = Math.sin(t * .9) * 1.6 * motion - (held && tear.p.x > 0 ? tear.dir * tear.p.x * 3 : 0);   // leans away from the pull only while it is being pulled
    if (state === 'idle' && !drag && tear.p.to < 1 && motion && t > nudgeAt) { P.rz.v += (Math.random() < .5 ? -1 : 1) * 70; if (tear.p.to) tear.th.v += 120; nudgeAt = t + rand(4, 7); }   // left alone it gives a little wiggle, and a half torn one flicks its strip at you
  }
  if (t > blinkAt) {
    blinkAt = t + rand(2.2, 5.5);
    if (motion && !pack.classList.contains('held')) blink(eyes);
  }
  { // pupils follow the pointer
    const dx = pointer.x - (innerWidth / 2 + P.x.x), dy = pointer.y - (innerHeight / 2 + P.y.x - PH * .02), dl = Math.hypot(dx, dy) || 1;
    const k = pointer.in ? Math.min(1, dl / 260) * PW * .014 : 0;
    eye.x.to = dx / dl * k; eye.y.to = dy / dl * k;
  }

  // springs, substepped so stiff ones stay stable on slow frames
  const springs = [...Object.values(P), ...Object.values(eye), tear.p, tear.th, tear.ph, squeeze, glow, ...ribbons.map(b => b.g), ...cards.flatMap(c => Object.values(c.p))];
  const n = Math.ceil(dt * 240), h = dt / n;
  for (let i = 0; i < n; i++) for (const s of springs) s.step(h);

  if (state === 'idle' && tear.p.x > 0) {
    const p = Math.min(1, tear.p.x), dp = p - tear.last; tear.last = p;
    sfx?.rip(dp > 0 ? (dp / Math.max(dt, .004) / 4) ** .6 : 0);   // the foil is only as loud as the hand is fast: slow is single crackles, a flick is one long rip
    if (dp > 0 && motion) {   // each bit of tear jolts the pack and spurts the flow
      P.rz.v += rand(-1, 1) * Math.min(dp, .02) * 900; P.y.v += dp * 420; tear.th.v += dp * 300; squeeze.v += dp * 20;
      for (const b of ribbons) if (b.on) b.g.v += dp * 6;
    }
    if (dp > 0 || Math.abs(tear.p.v) > .001) clips(p);   // held still, the torn shape is the same as last frame
    const draft = drag ? 0 : motion * (Math.sin(t * 5.3) + Math.sin(t * 8.7) * .5);   // let go of, the loose strip flaps in the draft coming out of the tear
    flap.style.transform = `rotateZ(${(tear.th.x + draft) * tear.dir}deg) rotateX(${tear.ph.x + draft * 1.5}deg)`;
    if (p > .985 && tear.p.to >= 1) open();
  }
  glow.to = (state === 'idle' && tear.p.x > 0) || ((state === 'open' || state === 'spread') && !reduce && !drained) ? 1 : 0;   // flows while it is torn, then goes up past the top of the screen, until the last of it has gone
  if (glow.x > .003 || glow.to) { rays.style.opacity = glow.x.toFixed(3); pour(dt); }
  if (fly) {
    fly.vy += 2600 * dt; fly.x += fly.vx * dt; fly.y += fly.vy * dt; fly.th += fly.vth * dt; fly.ph += fly.vph * dt;
    flap.style.transform = `translate3d(${fly.x}px,${fly.y}px,0) rotateZ(${fly.th * tear.dir}deg) rotateX(${fly.ph}deg)`;
    if (t - openedAt > 1.6) { fly = null; flap.className = 'flap'; }
  }
  if (state === 'open' && !fall && !reduce && t - openedAt > .02) fall = { y: 0, v: 1500 * PH / 420 };   // the deck kicks the pack down as it leaves
  if (fall && fall.y < innerHeight) { fall.v += 2800 * dt; fall.y += fall.v * dt; P.rz.to = tear.dir * 9; }

  if (pack.style.visibility !== 'hidden') {
    const fy = fall ? fall.y : 0;
    pack.style.transform = `translate3d(${P.x.x}px,${P.y.x + fy}px,0) rotateX(${P.rx.x}deg) rotateY(${P.ry.x}deg) rotateZ(${P.rz.x}deg) scale3d(${1 + .03 * squeeze.x},${1 - .06 * squeeze.x},1)`;
    if (!fall) {
      const ps = pack.style;   // the light is from the upper left: turning away pushes the glint round the left edge and dims it
      ps.setProperty('--gx', clamp(-P.ry.x * .12, -1.5, 3).toFixed(2)); ps.setProperty('--gl', clamp(.8 - P.ry.x * .012, .45, 1).toFixed(2));
      ps.setProperty('--gm', clamp(50 + P.ry.x * 1.2, 20, 80).toFixed(1)); ps.setProperty('--gt', clamp(.85 + P.rx.x * .015, .5, 1).toFixed(2));
      pack.style.setProperty('--sh', clamp(P.ry.x * 1.2 + P.rx.x * .8, -22, 22).toFixed(1));
      for (const el of pupils) el.style.transform = `translate(${eye.x.x}px,${eye.y.x}px)`;
    }
    if (fy > innerHeight) pack.style.visibility = 'hidden';
  }
  if (!fall) { anchor = { y: P.y.x, rz: P.rz.x, rx: P.rx.x, ry: P.ry.x, sq: squeeze.x }; flow.style.transform = pack.style.transform; }   // the jet rides with the pack until the pack drops
  else if (Math.abs(anchor.rz) + Math.abs(anchor.rx) + Math.abs(anchor.sq) > .01) {   // then it stands straight up, however the pack happened to be leaning when it tore
    const k = Math.exp(-dt / .05); anchor.rz *= k; anchor.rx *= k; anchor.ry *= k; anchor.sq *= k;
    flow.style.transform = `translate3d(${P.x.x}px,${anchor.y}px,0) rotateX(${anchor.rx}deg) rotateY(${anchor.ry}deg) rotateZ(${anchor.rz}deg) scale3d(${1 + .03 * anchor.sq},${1 - .06 * anchor.sq},1)`;
  }
  ground.style.transform = `translate3d(${P.x.x}px,${PH / 2 + 26}px,0) scale(${1 - P.y.x / 300})`;
  ground.style.opacity = state === 'enter' || state === 'idle' ? clamp(1 - Math.abs(P.x.x) / 300, 0, 1) : fall ? clamp(1 - fall.y / 160, 0, 1) : 0;

  // cards: the deck is fired straight up the pack, guided by its walls, as the light wrapper is thrown off it. once it is out it unwinds, and each card becomes its own layer so they can never cut through each other
  if (state === 'open' && !spreadAt && reduce) { spreadAt = t; scene.classList.add('flat'); }
  if (state === 'open' && !spreadAt && !reduce && cards.every(c => c.phase === 'shot')) {
    const mouth = P.y.x + (fall ? fall.y : 0) + PH * (Math.max(...jag.map(q => q[1])) / 100 - .5), ch = PW * 1.176;
    if (cards.every(c => c.p.y.x + ch * .36 < mouth)) unwind();
  }
  for (const c of cards) if (c.phase === 'orbit') orbit(c);
  [...cards].sort((a, b) => a.p.z.x - b.p.z.x).forEach((c, i) => c.rank = i + 1);   // the ones nearest you are drawn on top
  const hot = pointer.in || pointer.tap ? aimed() : null, tall = innerHeight > innerWidth * 1.15; pointer.tap = false;
  for (const c of cards) {
    const p = c.p, since = t - openedAt;
    if (c.phase === 'in' && !reduce && since > c.i * .022) { c.phase = 'shot'; p.s.to = 1; p.y.k = 0; p.y.c = 1.2; p.y.v = -rand(1250, 1450) * PH / 420; }
    if (c.phase === 'spread') {
      if (c === hot) c.until = t + (pointer.touch ? 1.1 : 0);   // a tapped card stays up for a moment after the finger has gone
      c.hover = c === hot || t < c.until || c.kb;
      if (c.kb && c !== hot) { c.hx = .5 + Math.sin(t * 1.7) * .22 * motion; c.hy = .5 + Math.cos(t * 1.3) * .16 * motion; }   // picked with the keyboard, it shows off its foil by itself
      const f = c.f, w = t * .8 + c.i * 1.9, on = c.hover;
      if (on !== c.glad) { c.glad = on; c.el.classList.toggle('glad', on); if (on) sfx?.lift(c.slot); }
      if (motion && t > c.blinkAt) { c.blinkAt = t + rand(2.2, 5.5); blink(c.eyes, Math.random() < .25 ? 2 : 1); }   // now and then a double blink
      p.x.to = f.x; p.s.to = f.s;
      p.y.to = f.y + (on ? -16 : Math.sin(w * 1.2) * 5 * motion);
      p.z.to = f.z + (on ? 110 : 0);
      p.rz.to = on ? f.rz * .3 : f.rz;
      p.rx.to = on ? (.5 - c.hy) * 36 : Math.cos(w * .9) * 4 * motion;
      p.ry.to = on ? (c.hx - .5) * 40 : Math.sin(w) * 8 * motion;
    }
    // inside the pack a card copies its tilt so it never pokes through the wrapper; once out, motion leans it like a card through air
    const loose = c.phase === 'spread' || c.phase === 'orbit';
    const rx = loose ? p.rx.x - clamp(p.y.v * .006, -8, 8) : P.rx.x, ry = loose ? p.ry.x + clamp(p.x.v * .008, -12, 12) : P.ry.x;
    c.el.style.transform = `translate3d(${p.x.x}px,${p.y.x}px,${p.z.x}px) rotateZ(${p.rz.x}deg) rotateX(${rx}deg) rotateY(${ry}deg) scale(${p.s.x})`;
    if (loose) c.up = c.hover || (c.up && p.z.x > c.f.z + 30);   // a card lifted by hover stays on top until it sinks back past its neighbour
    c.el.style.zIndex = c.up ? 9 : c.phase === 'orbit' || tall ? c.rank : cards.length - c.i;
    if (c.phase === 'spread') {   // the foil repaints the whole card, so it holds still in the air and eases in once the card has landed
      const a = reduce ? 1 : clamp((t - c.landAt - .2) / .5, 0, 1);
      if (a && (!handheld || c.up || a < 1)) {   // on a phone a card's foil only repaints while it is being touched or settling, so five cards at rest cost nothing
        const nx = clamp(ry / 24, -1, 1) * a, ny = clamp(rx / 24, -1, 1) * a, st = c.face.style;
        st.setProperty('--px', (50 + nx * 50).toFixed(1)); st.setProperty('--py', (50 - ny * 50).toFixed(1)); st.setProperty('--hyp', Math.min(1, Math.hypot(nx, ny)).toFixed(3));
      }
    }
  }
  if (state === 'open' && spreadAt && t > spreadAt + (reduce ? .1 : ORBIT + .3)) {
    state = 'spread'; again.hidden = false;
    if (viaKey) again.focus();
  }

  // confetti is paper in still air. gravity pulls it as hard as it pulls the pack; drag, which goes with the square of the speed, kills the pop in a moment
  // and then sets how fast it can fall; and it slips from side to side as it tumbles, spinning faster the faster it moves
  if (fxUsed) { fxc.setTransform(1, 0, 0, 1, 0, 0); fxc.clearRect(0, 0, fx.width, fx.height); fxUsed = false; }
  const D = fx.width / innerWidth, ox = innerWidth / 2, oy = innerHeight * .4, R = Math.PI / 180;   // the same perspective as the stage
  bits = bits.filter(b => {
    if (b.age === undefined || (b.age += dt) < 0) return true;
    if (b.inside) {   // hidden by the front of the pack until it comes up past the torn edge, and only then does it fan out
      b.ly -= b.up * dt / PH * 100; b.r += b.spin * dt;
      if (b.ly > yAt(b.lx)) return true;
      [b.x, b.y, b.z] = onStage(b.lx, b.ly, b.lz);
      b.inside = false; b.age = 0; b.r0 = b.r; b.vx = Math.sin(b.a) * b.sp; b.vy = -Math.cos(b.a) * b.sp; b.vz = rand(0, 160);
    }
    b.z += b.vz * dt; b.vy += 2600 * dt; b.vx += (Math.sin(b.ph) * b.slip + b.glide) * dt;   // flat paper slips from side to side as it tumbles and glides off to one side, so the cloud keeps spreading as it falls
    // a clump thrown together cuts through the air, so each piece only feels its full drag once the clump has opened up
    const v = Math.hypot(b.vx, b.vy), f = 1 / (1 + b.c * Math.min(1, .06 + b.age / .45) * v * dt), turn = .35 + v / 800;   // drag solved implicitly, so a hard pop can't overshoot and reverse
    b.vx *= f; b.vy *= f; b.x += b.vx * dt; b.y += b.vy * dt; b.r += b.spin * turn * dt; b.ph += 7 * turn * dt;
    if (b.y >= innerHeight / 2 + 40) return false;
    const p = 1400 / (1400 - b.z), k = D * p * b.sc, cr = Math.cos(b.r * R), sr = Math.sin(b.r * R), cq = Math.cos((b.r - b.r0) * .7 * R);   // tumbling: its height foreshortens as it turns over
    fxc.setTransform(k * cr, k * sr, -k * sr * cq, k * cr * cq, (ox + b.x * p) * D, (oy + (innerHeight * .1 + b.y) * p) * D);
    fxc.fillStyle = b.fill; fxc.fill(BIT[b.kind]); fxUsed = true;
    return true;
  });
  calm = (state === 'spread' && !bits.length && !cards.some(c => c.up || t < c.landAt + 1)) || (state === 'idle' && !drag && !tear.p.x);
  requestAnimationFrame(frame);
}

const track = e => { pointer.x = e.clientX; pointer.y = e.clientY; pointer.in = true; pointer.touch = e.pointerType !== 'mouse'; };
addEventListener('pointermove', track);
addEventListener('pointerdown', e => { track(e); pointer.tap = true; });
document.documentElement.addEventListener('pointerleave', () => pointer.in = false);
addEventListener('blur', e => { letGo(e); pointer.in = false; });   // switched away: whatever was held gets let go of
addEventListener('resize', () => { if (!innerWidth || !innerHeight) return; measure(); fit(); if (state === 'idle' && tear.p.x > 0) clips(Math.min(1, tear.p.x)); for (const c of cards) if (c.f) c.f = fan(c); });   // cards in the air or on the table glide to their new places
addEventListener('keydown', e => {   // along the row with the arrow keys, from wherever the focus is
  if (state !== 'spread' || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
  const d = e.key === 'ArrowLeft' ? -1 : 1, at = cards.find(c => c.el === document.activeElement), slot = at ? clamp(at.slot + d, 0, cards.length - 1) : d > 0 ? 0 : cards.length - 1;
  cards.find(c => c.slot === slot).el.focus({ preventScroll: true }); e.preventDefault();
});
again.addEventListener('click', () => {
  sfx?.tick();
  for (const c of cards) c.el.remove();
  cards = []; again.hidden = true; enter();
  if (viaKey) hit.focus();
});

/* rounded, bulging sides: strips stacked through the pouch's depth, each pushed out a little further toward the middle
   of the depth and standing shorter the further back it sits, so the edge rolls away from the face, swells, and tapers into the seals */
const rims = [];
for (const s of [-1, 1]) for (const deg of [80, 60, 40, 20, 0, -20, -40, -60, -80]) {
  const a = deg * Math.PI / 180, back = (1 - Math.sin(a)) / 2, o = 4, b = 5 * Math.cos(a), el = document.createElement('i');
  const edge = Array.from({ length: 13 }, (_, i) => [(o + b * Math.sin(Math.PI * i / 12) ** .8) / (o + b) * 100, i / 12 * 100]);
  const shape = [[0, 0], ...edge, [0, 100]], tone = s > 0 ? `#000 ${(10 + back * 40).toFixed(0)}%` : `#fff ${(45 * (1 - back)).toFixed(0)}%`;   // lit from the left like the face: the streak rolls round the left side, the shade deepens round the right
  el.className = 'rim';
  el.style.cssText = `${s > 0 ? 'left' : 'right'}:calc(50% + var(--pw)*.476 - ${o}px);width:${(o + b).toFixed(2)}px;top:${(11.5 + back * 13).toFixed(2)}%;bottom:${(11.5 + back * 13).toFixed(2)}%;` +
    `transform:translateZ(calc(var(--d)*${(Math.sin(a) / 2).toFixed(3)}));clip-path:${poly(s > 0 ? shape : mirror(shape))};background:color-mix(in srgb,var(--pack),${tone})`;
  pack.insertBefore(el, flap); rims.push({ el, s, top: 11.5 + back * 13 });
}
/* rainbow flow: a fan of ribbons pours out of the whole torn part of the opening, side by side with no gaps, the seven colours repeating
   across it. the ribbons radiate from a point below the pack, so the middle ones go straight up and the outer ones off diagonally. every
   edge is a wave travelling out along it, so the fan flows; each ribbon leaves the opening white hot and fades as it goes, and motes of
   light drift out inside. in the svg's units the tear line sits at y 60; the ribbons start just under it, where the wrapper hides them,
   and each pours once the tear reaches it, straight out past the top of the screen. once the pack is fully torn the tail lets go of the
   opening and follows it, so the whole thing carries on up and off the top in under a second. redrawn for every pack */
const BANDS = ['#ff3d6e', '#ff8a3d', '#ffd34d', '#4fd9a0', '#4fb2ff', '#8b6cff', '#ff5cc8'], NR = 35, CY = 107.5, STEP = handheld ? 3.5 : 2.5, SPAN = 1500, TIP = 36;
const tint = (hex, k) => '#' + [1, 3, 5].map(i => Math.round(parseInt(hex.slice(i, i + 2), 16) * (1 - k) + 255 * k).toString(16).padStart(2, '0')).join('');
const ribbon = (a, b) => `M${a.join('L')}L${b.slice().reverse().join('L')}Z`;
let lines = [], ribbons = [], motes = [], bandEls = [], edgeEls = [], stops = [], reach = 0, drained = false, Y0 = 62.5, R0 = 45;
function sprout() {
  const k0 = rand(0, 7) | 0, u = PW / 100;   // which colour the fan starts with
  Y0 = 62.5 + (Y_MAX - TEAR) / 100 * PH / u; R0 = CY - Y0;   // the ribbons start below the deepest any tear can go, on the same lines as if they started at the mouth
  lines = Array.from({ length: NR + 1 }, (_, j) => {   // the edges between ribbons, aimed out from (50, Y0 + R0)
    const ox = 3 + 94 * j / NR, x = 50 + (ox - 50) * R0 / 45, a = Math.atan2(x - 50, R0) + rand(-.012, .012);
    return { ox, x, ux: Math.sin(a), uy: -Math.cos(a), ph: j * .35 + rand(-.1, .1), r: Math.hypot(x - 50, R0) };
  });
  // each ribbon runs out to where the fade has taken it, so the middle ones reach furthest
  ribbons = Array.from({ length: NR }, (_, j) => { const r = (lines[j].r + lines[j + 1].r) / 2; return { mx: (lines[j].ox + lines[j + 1].ox) / 2, gx: (lines[j].x + lines[j + 1].x) / 2, r, L: 0, c: BANDS[(j + k0) % 7], on: false, len: 0, g: new Spring(0, .4, reduce ? 0 : .3) }; });
  rays.innerHTML = `<defs><radialGradient id="mote"><stop offset=".2" stop-color="#fff"/><stop offset=".45" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>
    ${ribbons.map((b, j) => { const ux = (lines[j].ux + lines[j + 1].ux) / 2, uy = (lines[j].uy + lines[j + 1].uy) / 2;
      const hot = 26 + Y0 - 62.5; return `<linearGradient id="b${j}" gradientUnits="userSpaceOnUse" x1="${b.gx.toFixed(2)}" y1="${Y0}" x2="${(b.gx + ux * hot).toFixed(2)}" y2="${(Y0 + uy * hot).toFixed(2)}"><stop stop-color="${tint(b.c, .7)}"/><stop offset="1" stop-color="${b.c}"/></linearGradient>`; }).join('')}
    <radialGradient id="fade-g" gradientUnits="userSpaceOnUse" cx="50" cy="${Y0 + R0}" r="${SPAN}"><stop stop-color="#fff" stop-opacity="0"/><stop stop-color="#fff"/><stop stop-color="#fff"/><stop stop-color="#fff" stop-opacity="0"/></radialGradient>
    <mask id="fade" maskUnits="userSpaceOnUse"><rect fill="url(#fade-g)"/></mask>
    <filter id="bloom" filterUnits="userSpaceOnUse"><feGaussianBlur stdDeviation="2.4"/><feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
    <g${handheld ? '' : ' filter="url(#bloom)"'}><g${handheld ? '' : ' mask="url(#fade)"'}>${ribbons.map((b, j) => `<path class="band" fill="url(#b${j})"/>`).join('')}
    ${handheld ? '' : `<g fill="none" stroke="#fff" stroke-opacity=".7" stroke-width=".4">${'<path class="edge"/>'.repeat(NR + 1)}</g>`}${'<circle class="mote" fill="url(#mote)"/>'.repeat(10)}</g></g>`;
  bandEls = [...rays.querySelectorAll('.band')]; edgeEls = [...rays.querySelectorAll('.edge')]; stops = [...rays.querySelectorAll('#fade-g stop')];
  motes = [...rays.querySelectorAll('.mote')].map(el => ({ el, j: -1, u: Math.random(), v: rand(.2, .8), sp: rand(.3, .5), r: rand(1.6, 3) }));
  fit();
}
function fit() {   // all that depends on the size of the window, so a resized window or a turned phone still has the fan reaching the top
  const u = PW / 100, room = 2.5 + (innerHeight / 2 - PH * (.5 - TEAR / 100)) / u, w = Math.min(innerWidth / 2 / u, room * 1.2 + 60) + 20;   // how far up the top of the screen is, and as much of the screen as it can reach
  reach = reduce ? 45 + room * .6 : (45 + room) * Math.hypot(47 / 45, 1) + TIP + 20;   // long enough for the outermost ribbon to leave the top of the screen, soft tip and all. with reduced motion nothing that big moves, so it stays a short glow
  for (const b of ribbons) b.L = reach - b.r;
  const box = { x: 50 - w, y: 32.5 - room, width: 2 * w, height: room + 60 };
  for (const el of rays.querySelectorAll('#fade,#fade rect,#bloom')) for (const k in box) el.setAttribute(k, box[k].toFixed(1));
}
function pour(dt) {
  const ft = reduce ? 0 : t, xt = tear.dir > 0 ? tear.p.x * 100 : 100 - tear.p.x * 100, sway = Math.sin(ft * .9) * 1.5;
  const go = !reduce && (state === 'open' || state === 'spread'), s = t - openedAt, u = PW / 100, a = anchor.rz * Math.PI / 180;
  const roof = 60 + ((-innerHeight / 2 - anchor.y) / Math.cos(a) + PH * (.5 - TEAR / 100)) / u, soft = TIP;   // the top of the screen, from where the pack holds the flow
  // thrown: the front leaves the opening fast and slows as it goes out past the top, even along the outermost ribbons, and the tail is right behind it,
  // following it up and off so the whole thing is over in under a second
  const full = (Y0 + R0 - roof) * ribbons[0].r / R0 + soft + 20;
  const far = go ? reach + (full - reach) * (1 - (1 - Math.min(1, s / .5)) ** 2) : reach, tail = R0 - 5 + (go ? (full + 21 - R0) * clamp((s - .35) / .55, 0, 1) ** 2 : 0);
  const carry = go ? 45 * s * s / (s + .25) : 0;   // once it is thrown the crests travel up a little faster
  for (const b of ribbons) {
    if (state === 'idle' && tear.p.x > 0 && (tear.dir > 0 ? b.mx < xt : b.mx > xt)) b.on = true;
    b.g.to = b.on ? 1 : 0; b.len = b.L * Math.max(0, b.g.x) + far - reach;
  }
  if (!handheld) [tail - 16, tail, far - soft, far].forEach((o, i) => stops[i].setAttribute('offset', clamp(Math.min(o, far) / SPAN, 0, 1).toFixed(4)));
  // a point d along edge j: out along its direction, pushed sideways by a wave that grows as it goes and travels out along it
  const at = (j, d) => {
    const e = lines[j], k = Math.min(1, d / 90), w = (.4 + 2 * k) * Math.sin(((d - carry) / 22 - ft * 1.4) * 2 * Math.PI + e.ph) + sway * k;
    return [e.x + e.ux * d - e.uy * w, Y0 + e.uy * d + e.ux * w];
  };
  // each edge is worked out once a frame and shared by the ribbons on either side of it, always at the same distances so no seam opens between them. it stops just past the edge of the screen, where nobody can see it
  const lead = handheld ? 0 : 20, side = innerWidth / 2 / u + 14, fix = v => Math.round(v * 20) / 20;
  const edges = lines.map((e, j) => {
    const stop = Math.min((Y0 - roof) / -e.uy, (side - Math.abs(e.x - 50)) / Math.abs(e.ux)) + 24, len = Math.min(Math.max(ribbons[j - 1]?.len || 0, ribbons[j]?.len || 0), stop), i0 = Math.max(0, Math.floor((tail - lead - e.r) / STEP)), pts = [];
    if (len > i0 * STEP) for (let i = i0; ; i++) { const d = Math.min(i * STEP, len), [x, y] = at(j, d); pts.push(`${fix(x)} ${fix(y)}`); if (d >= len) break; }
    return { i0, pts };
  });
  const upto = (e, len) => e.pts.slice(0, Math.max(0, Math.ceil(len / STEP) - e.i0 + 1));
  ribbons.forEach((b, j) => { const A = upto(edges[j], b.len), B = upto(edges[j + 1], b.len); bandEls[j].setAttribute('d', A.length > 1 && B.length > 1 ? ribbon(A, B) : ''); });
  edgeEls.forEach((el, j) => el.setAttribute('d', edges[j].pts.length > 1 ? `M${edges[j].pts.join('L')}` : ''));
  drained = go && s > .9;
  const out = ribbons.flatMap((b, j) => b.on ? [j] : []);
  for (const m of motes) {
    if (!reduce) m.u += dt * m.sp;
    if (m.u > 1 || !ribbons[m.j]?.on) {
      if (m.u > 1) m.u -= 1;
      if (!out.length) { m.el.setAttribute('opacity', 0); continue; }
      m.j = out[rand(0, out.length) | 0];
    }
    const len = ribbons[m.j].len, d0 = Math.max(0, tail - lines[m.j].r), d = d0 + m.u * (len - d0), [x1, y1] = at(m.j, d), [x2, y2] = at(m.j + 1, d);
    m.el.setAttribute('cx', (x1 + (x2 - x1) * m.v).toFixed(2)); m.el.setAttribute('cy', (y1 + (y2 - y1) * m.v).toFixed(2));
    m.el.setAttribute('r', (m.r * (.6 + m.u * .7)).toFixed(2)); m.el.setAttribute('opacity', (Math.sin(Math.PI * m.u) * Math.min(1, len / 20)).toFixed(2));
  }
}

/* ---------- sound ---------- */
/* all of it is synthesised, so the page stays one file. foil is noise shaped by folds giving way; everything else is a toy chime or a tiny voice on one pentatonic
   scale, so whatever overlaps still agrees. nothing plays until the first press, which is when browsers allow it. to make it all louder or quieter change VOLUME */
const VOLUME = .8, note = i => 440 * 2 ** ((72 + 12 * (i / 5 | 0) + [0, 2, 4, 7, 9][i % 5] - 69) / 12);   // i steps up a C major pentatonic from C5
function voices(ctx) {
  const sr = ctx.sampleRate, now = () => ctx.currentTime;
  const master = ctx.createGain(), limit = ctx.createDynamicsCompressor(), room = ctx.createConvolver(), wet = ctx.createGain();
  Object.entries({ threshold: -9, knee: 6, ratio: 8, attack: .002, release: .1 }).forEach(([k, v]) => limit[k].value = v);
  master.gain.value = VOLUME; wet.gain.value = .3;
  master.connect(limit).connect(ctx.destination); room.connect(wet).connect(master);
  const sheet = (channels, seconds, fill) => { const b = ctx.createBuffer(channels, seconds * sr | 0, sr); for (let c = 0; c < channels; c++) fill(b.getChannelData(c)); return b; };
  const hiss = sheet(1, 2, d => { for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; });
  const foil = sheet(1, 2, d => {   // hundreds of tiny ticks, a few loud and most faint: each is one fold of foil giving way. played quietly only the loud ones are heard
    for (let n = 0; n < 900; n++) {
      const start = Math.random() * (d.length - 400) | 0, amp = Math.random() ** 3 * (Math.random() < .5 ? -1 : 1), len = 30 + Math.random() * 260 | 0;
      for (let i = 0; i < len; i++) d[start + i] += amp * (Math.random() * 2 - 1) * Math.exp(-i / len * 5);
    }
  });
  room.buffer = sheet(2, handheld ? .5 : .9, d => { let soft = 0; for (let i = 0; i < d.length; i++) { const k = i / d.length; soft += (Math.random() * 2 - 1 - soft) * (.5 - .42 * k); d[i] = soft * (1 - k) ** 3; } });   // a small bright room that darkens as it dies
  const env = (param, at, peak, attack, dur) => { param.setValueAtTime(.0001, at); param.exponentialRampToValueAtTime(peak, at + attack); param.exponentialRampToValueAtTime(.0001, at + dur); };
  const out = (node, send) => { node.connect(master); if (send) { const s = ctx.createGain(); s.gain.value = send; node.connect(s).connect(room); } };
  function air({ at = now(), buffer = hiss, type = 'bandpass', from, to, Q = 1, gain, attack = .004, dur, send = 0, pan = [0, 0], bell = false }) {   // a shaped puff of noise
    const s = ctx.createBufferSource(), f = ctx.createBiquadFilter(), g = ctx.createGain(), p = ctx.createStereoPanner();
    s.buffer = buffer; s.loop = true; f.type = type; f.Q.value = Q;
    f.frequency.setValueAtTime(from, at); f.frequency.exponentialRampToValueAtTime(to, at + dur);
    if (bell) g.gain.setValueCurveAtTime(Float32Array.from({ length: 48 }, (_, i) => gain * Math.sin(Math.PI * i / 47) ** 2), at, dur); else env(g.gain, at, gain, attack, dur);   // a bell fades in and out with no edge at all
    if (pan.length > 2) p.pan.setValueCurveAtTime(pan, at, dur); else { p.pan.setValueAtTime(pan[0], at); p.pan.linearRampToValueAtTime(pan[1], at + dur); }
    s.connect(f).connect(g).connect(p); out(p, send);
    s.start(at, Math.random() * 1.8); s.stop(at + dur + .02);
  }
  function chime(freq, { at = now(), gain = .1, dur = .5, send = .5, pan = 0 } = {}) {   // a toy xylophone bar: the note and the two overtones a bar has, which die sooner
    const g = ctx.createGain(), p = ctx.createStereoPanner();
    g.gain.value = gain; p.pan.value = pan; g.connect(p); out(p, send);
    for (const [ratio, level, life] of [[1, 1, 1], [3.9, .18, .22], [9.2, .05, .08]]) {
      const o = ctx.createOscillator(), a = ctx.createGain(), d = Math.max(.03, dur * life);
      o.frequency.value = freq * ratio; env(a.gain, at, level, .002, d);
      o.connect(a).connect(g); o.start(at); o.stop(at + d + .02);
    }
  }
  function coo(freq, shape, { at = now(), gain = .06, attack = .008, wobble = 0, send = .25, pan = 0, wave = 'triangle' } = {}) {   // a tiny mouth: a round tone following a contour of [seconds, pitch] points. wobble makes it tremble
    const o = ctx.createOscillator(), g = ctx.createGain(), p = ctx.createStereoPanner(), dur = shape.at(-1)[0] + .05;
    o.type = wave; p.pan.value = pan;
    for (const [s, m] of shape) if (s) o.frequency.exponentialRampToValueAtTime(freq * m, at + s); else o.frequency.setValueAtTime(freq * m, at);
    env(g.gain, at, gain, attack, dur);
    if (wobble) { const l = ctx.createOscillator(), d = ctx.createGain(); l.frequency.value = 24; d.gain.value = freq * wobble; l.connect(d).connect(o.frequency); l.start(at); l.stop(at + dur + .02); }
    o.connect(g).connect(p); out(p, send); o.start(at); o.stop(at + dur + .02);
  }
  const sparkle = (n, at, spread, level) => { for (let i = 0; i < n; i++) chime(note(8 + Math.random() * 5 | 0), { at: at + Math.random() ** 1.4 * spread, gain: level * (.6 + Math.random() * .8), dur: .35, send: .9, pan: Math.random() * 1.4 - .7 }); };
  // the tear itself never stops playing, it just sits at silence until the hand moves
  const ripBody = ctx.createBufferSource(), ripShape = ctx.createBiquadFilter(), ripTop = ctx.createBiquadFilter(), ripGain = ctx.createGain();
  ripBody.buffer = foil; ripBody.loop = true; ripShape.type = 'bandpass'; ripShape.Q.value = .6; ripTop.type = 'lowpass'; ripTop.frequency.value = 6000; ripGain.gain.value = 0;
  ripBody.connect(ripShape).connect(ripTop).connect(ripGain); out(ripGain, .12); ripBody.start();
  let level = 0;
  return {
    ctx,
    mute(off, at = now()) { master.gain.setTargetAtTime(off ? 0 : VOLUME, at, .015); },
    rip(v, at = now()) {
      v = clamp(v, 0, 1); if (Math.abs(v - level) < .01 && (v || !level)) return;
      const rising = v > level; level = v;
      ripGain.gain.setTargetAtTime(v ** .8 * .15, at, rising ? .008 : .05);
      ripShape.frequency.setTargetAtTime(1800 + 2000 * v, at, .02); ripBody.playbackRate.setTargetAtTime(.7 + .8 * v, at, .02);
    },
    grab(at = now()) { air({ at, buffer: foil, from: 3000, to: 2200, Q: .7, gain: .3, attack: .003, dur: .09 }); },
    eep(at = now()) { coo(1250, [[0, .82], [.05, 1.25], [.13, 1.02]], { at, gain: .05, wobble: .04 }); },   // the star's little yelp as the tear starts
    phew(at = now()) { coo(900, [[0, 1.1], [.24, .6]], { at, gain: .05, send: .45 }); air({ at, from: 1500, to: 700, Q: .6, gain: .03, attack: .02, dur: .26 }); },   // and its sigh of relief when you let go
    boing(at = now()) { coo(340, [[0, .8], [.05, 1.6], [.12, .85], [.2, 1.25], [.3, 1]], { at, gain: .12, send: .2 }); },   // pulled about and let go
    pop(flies, at = now()) {
      air({ at, from: 5000, to: 1800, Q: .9, gain: .14, attack: .002, dur: .1 });   // the last of the strip letting go
      coo(300, [[0, .8], [.05, 3.4]], { at, gain: .3, send: .15 });   // pop, like a bubble
      if (!flies) return;
      air({ at: at + .01, from: 500, to: 3200, Q: .8, gain: .09, attack: .2, dur: .7, send: .6 });   // the rainbow going up
      coo(540, [[0, 1], [.6, 3]], { at: at + .02, gain: .03, attack: .22, wobble: .012, send: .6 });   // wheee
      sparkle(3, at + .12, .5, .018);   // a faint glint or two off the confetti
    },
    swirl(len, at = now()) {   // the ring of cards going round you: air sweeping from side to side, tightening as it settles
      air({ at, from: 700, to: 1800, Q: .9, gain: .12, attack: len * .4, dur: len, send: .4, pan: Float32Array.from({ length: 64 }, (_, i) => { const u = i / 63; return Math.cos((1 - (1 - u) ** 2) * Math.PI * 2.5) * (1 - u) * .8; }) });
    },
    land(name, slot, at = now()) {   // paper on a table. only the best card says anything, so the row lands quietly with one small payoff
      air({ at, from: 2600, to: 1300, Q: .6, gain: .07, attack: .002, dur: .05 });
      if (name === 'nova') coo(659, [[0, .94], [.035, 1]], { at: at + .06, gain: .04, attack: .006, send: .06, pan: (slot - 2) * .18, wave: 'sine' });
    },
    lift(slot, at = now()) {   // a card rising towards you on hover: one dark, soft breath with nothing bright in it, peaking as the card moves fastest
      const side = (slot - 2) * .18;
      air({ at, type: 'lowpass', from: 760, to: 480, Q: .3, gain: 0.0449, bell: true, dur: .22, pan: [side, side] });
    },
    tick(at = now()) { coo(880, [[0, .9], [.05, 1.12]], { at, gain: .04, send: 0 }); },
    arrive(at = now()) {   // comes in from the right, settles with a crinkle and says hi
      air({ at, from: 900, to: 2600, gain: .06, attack: .3, dur: .75, send: .4, pan: [.7, 0] });
      air({ at: at + .72, buffer: foil, from: 3000, to: 2200, Q: .7, gain: .16, attack: .003, dur: .09 });
      coo(note(3), [[0, .9], [.05, 1.03]], { at: at + .78, gain: .05 }); coo(note(5), [[0, .9], [.06, 1.03]], { at: at + .87, gain: .05 });
    },
  };
}
let sfx, muted = false;
try { muted = localStorage.getItem('holo-muted') === '1'; } catch {}
const muteBtn = $('#mute');
muteBtn.setAttribute('aria-pressed', muted);
function wake() {
  if (sfx) { if (sfx.ctx.state === 'suspended') sfx.ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  try {   // sound is a nicety: if it can't start, or a voice ever fails, the animation carries on without it
    const v = voices(new AC({ latencyHint: 'interactive' }));
    sfx = Object.fromEntries(Object.entries(v).map(([k, f]) => [k, typeof f === 'function' ? (...a) => { try { return f(...a); } catch {} } : f]));
    sfx.mute(muted); sfx.ctx.resume();
  } catch { sfx = undefined; }
}
for (const type of ['pointerdown', 'pointerup', 'touchend', 'click', 'keydown']) addEventListener(type, wake, true);
muteBtn.addEventListener('click', () => {
  muted = !muted; muteBtn.setAttribute('aria-pressed', muted); sfx?.mute(muted); if (!muted) sfx?.tick();
  try { localStorage.setItem('holo-muted', muted ? '1' : '0'); } catch {}
});
document.addEventListener('visibilitychange', () => { if (document.hidden) sfx?.rip(0); });   // frames stop in a hidden tab, so nothing else would ever turn the tear down

measure(); enter(); requestAnimationFrame(frame);
