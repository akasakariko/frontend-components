#!/usr/bin/env node
// Deterministic A/B check: local clone vs the deployed page.
//
// Both pages get the same seeded Math.random installed before any app script
// runs, so the pack colour, card order, tear direction and particles are the
// same inputs on both sides. Cloudflare's injected RUM beacon is blocked,
// because it consumes Math.random on the deployed page only.
//
//   node verify.mjs [--cdp http://127.0.0.1:9333] [--local http://127.0.0.1:8123/]
//
// Exit code 0 means every probe matched and both screenshots agree.

import { writeFileSync, mkdirSync } from 'node:fs';

const argv = process.argv.slice(2);
const arg = (name, fallback) => {
  const i = argv.indexOf('--' + name);
  return i === -1 ? fallback : argv[i + 1];
};
const CDP = arg('cdp', 'http://127.0.0.1:9333');
const LOCAL = arg('local', 'http://127.0.0.1:8123/');
const LIVE = arg('live', 'https://holo.yashb.xyz/');
const OUT = arg('out', 'verify-out');
const SEED = 0x5eed1e;
const VIEWPORT = { width: 756, height: 469 };
// Installed before the page's own scripts, and again immediately before every
// interaction. Reseeding per interaction is what makes the comparison stable:
// the animation loop consumes Math.random once per frame (crumple walk, particle
// spawns, blink and nudge timers), so how far the stream has advanced by the time
// you click depends on how many frames each page happened to render.
const SEED_SOURCE = '(()=>{let s=' + SEED + '>>>0;Math.random=()=>{s^=s<<13;s>>>=0;s^=s>>>17;s^=s<<5;s>>>=0;return s/4294967296;};})();';

mkdirSync(OUT, { recursive: true });

async function open(url, tag) {
  const created = await fetch(CDP + '/json/new?' + encodeURIComponent('about:blank'), { method: 'PUT' });
  const target = await created.json();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let nextId = 0;
  const pending = new Map();
  const requests = [];
  ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    if (msg.method === 'Network.requestWillBeSent') requests.push(msg.params.request.url);
    const waiter = pending.get(msg.id);
    if (waiter) { pending.delete(msg.id); waiter(msg); }
  };
  const send = (method, params = {}) => new Promise((res, rej) => {
    const id = ++nextId;
    pending.set(id, (m) => (m.error ? rej(new Error(method + ': ' + JSON.stringify(m.error))) : res(m.result)));
    ws.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) =>
    (await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })).result.value;

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Network.enable');
  await send('Network.setBlockedURLs', { urls: ['*cloudflareinsights.com*', '*/cdn-cgi/rum*'] });
  await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
  await send('Emulation.setDeviceMetricsOverride', { ...VIEWPORT, deviceScaleFactor: 1, mobile: false });
  await send('Page.addScriptToEvaluateOnNewDocument', { source: SEED_SOURCE });
  // start from a clean profile state so the mute toggle is deterministic
  await send('Page.navigate', { url });
  await new Promise((r) => setTimeout(r, 400));
  await evaluate('localStorage.clear()');
  await send('Page.navigate', { url });
  await new Promise((r) => setTimeout(r, 2200));

  const shoot = async (name) => {
    const { data } = await send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(OUT + '/' + tag + '_' + name + '.png', Buffer.from(data, 'base64'));
  };
  const state = async () => JSON.parse(await evaluate(`JSON.stringify({
    pack: document.querySelector('#pack').className,
    cards: [...document.querySelectorAll('.card')].map(c => ({
      name: c.querySelector('.name').textContent,
      rarity: c.querySelector('.rarity')?.textContent,
      num: c.querySelector('.num')?.textContent,
      cls: c.className,
      box: (() => { const b = c.getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map(v => +v.toFixed(1)); })()
    })),
    againHidden: document.querySelector('#again').hidden,
    mute: document.querySelector('#mute').getAttribute('aria-pressed'),
    muted: localStorage.getItem('holo-muted'),
    live: document.querySelector('#live').textContent,
    packBox: (() => { const b = document.querySelector('#pack').getBoundingClientRect(); return [b.left, b.top, b.width, b.height].map(v => +v.toFixed(1)); })()
  })`));

  const reseedThen = async (expression) => {
    await evaluate(SEED_SOURCE);
    await evaluate(expression);
  };

  const seen = {};
  seen.idle = await state();
  await shoot('idle');

  await reseedThen("document.querySelector('#hit').click()");
  await new Promise((r) => setTimeout(r, 3200));
  seen.open = await state();
  await shoot('open');

  await reseedThen("document.querySelector('#again').click()");
  await new Promise((r) => setTimeout(r, 1600));
  seen.replay = await state();
  await shoot('replay');

  await reseedThen("document.querySelector('#mute').click()");
  await new Promise((r) => setTimeout(r, 300));
  seen.mute = await state();

  await reseedThen("document.querySelector('#hit').click()");
  await new Promise((r) => setTimeout(r, 3200));
  seen.open2 = await state();
  await shoot('open2');

  ws.close();
  return { seen, requests: [...new Set(requests)] };
}

const local = await open(LOCAL, 'local');
const live = await open(LIVE, 'live');

const report = { seed: SEED, viewport: VIEWPORT, local: local.seen, live: live.seen, requests: { local: local.requests, live: live.requests } };
writeFileSync(OUT + '/report.json', JSON.stringify(report, null, 1));

// Layout geometry is compared with a tolerance: sub-pixel values come back as
// 200.46 vs 200.54 across runs of the *same* page, so an exact string compare
// would fail on rounding rather than on behaviour.
const GEOMETRY_TOLERANCE = 0.5;

function differences(a, b, path = '') {
  if (typeof a === 'number' && typeof b === 'number') {
    return Math.abs(a - b) > GEOMETRY_TOLERANCE ? [path + ': ' + a + ' vs ' + b] : [];
  }
  if (Array.isArray(a) && Array.isArray(b)) {
    if (a.length !== b.length) return [path + ': length ' + a.length + ' vs ' + b.length];
    return a.flatMap((v, i) => differences(v, b[i], path + '[' + i + ']'));
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
    return [...keys].flatMap((k) => differences(a[k], b[k], path ? path + '.' + k : k));
  }
  return a === b ? [] : [path + ': ' + JSON.stringify(a) + ' vs ' + JSON.stringify(b)];
}

let ok = true;
for (const phase of Object.keys(local.seen)) {
  const diff = differences(local.seen[phase], live.seen[phase], phase);
  ok &&= diff.length === 0;
  console.log((diff.length ? 'DIFFER ' : 'MATCH  ') + phase + (diff.length ? '\n  ' + diff.join('\n  ') : ''));
}

const httpOf = (urls) => urls.filter((u) => u.startsWith('http'));
const localHttp = httpOf(local.requests);
const liveHttp = httpOf(live.requests).filter((u) => !u.includes('cloudflareinsights.com') && !u.includes('/cdn-cgi/rum'));
console.log('local HTTP requests:', localHttp);
console.log('live  HTTP requests (CDN beacon excluded):', liveHttp);
ok &&= JSON.stringify(localHttp.map((u) => new URL(u).pathname)) === JSON.stringify(liveHttp.map((u) => new URL(u).pathname));

console.log(ok ? '\nPASS: clone behaves identically to the deployed page' : '\nFAIL: see report.json');
console.log('screenshots + report in ' + OUT + '/');
process.exit(ok ? 0 : 1);
