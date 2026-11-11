# Holo Card Pack

A local, editable copy of the single-page "Card pack" app at
[holo.yashb.xyz](https://holo.yashb.xyz/), rebuilt from the deployed artifact and
verified against it.

## What it is

A holographic card pack you tear open to deal five collectible characters. The
whole thing is one self-contained HTML document (~288 KiB): 3D pack geometry in
CSS, Blender-rendered artwork inline as `data:` URIs, tear/deal/lift physics and
a full Web Audio synth in plain JavaScript. No framework, no build step, no
runtime requests.

| piece | where | what it is |
|---|---|---|
| CSS | `src/styles.css` | ~17.8 KB of hand-written CSS: 3D pack/pouch, crimped heat-seal mask, glitter noise SVG, card faces, foil, particle layers |
| `ART` data | `src/art-data.js` | 31 inline WebP characters/effects + 3 inline SVG assets, exported from Blender (body, eyes, mouth, joy, sweat, ouch, …) |
| app logic | `src/app.js` | ~58 KB: pack tear physics, card deal/flip/lift, parallax, sparkle particles, and a full Web Audio synth (tear hiss, foil, chimes) |

The only external requests the deployed page makes are Cloudflare's injected RUM
beacon (`static.cloudflareinsights.com`) and `POST /cdn-cgi/rum` — those come
from the CDN, not the app. Nothing is fetched at runtime for the artwork: every
image is a `data:` URI. No cookies, no storage apart from the mute flag, no API.

## Layout

```
index.html            the built page (open this)
original/index.html   the captured deployment (do not edit; the reference bytes)
provenance.json       source URL, SHA-256, per-part sizes
split.py              original/index.html -> src/* (byte-exact split)
build.py              src/* -> index.html (fails if SHA-256 differs)
serve.py              static server for this folder
verify.mjs            headless A/B of this copy against the live page
compare_screens.py    pixel comparison of the screenshots verify.mjs wrote
src/                  the editable sources
verify-out/           screenshots + report.json from the last verify run
```

## Use

Open `index.html` directly, or:

```bash
python3 serve.py     # http://127.0.0.1:8000/
```

Drag across the top of the pack to tear it, or just press it. Click the speaker
to mute; the flag is remembered under `localStorage['holo-muted']`.

Edit `src/*` and run `python3 build.py` to reassemble. Because the split is
byte-exact, an untouched tree always rebuilds to
`32953f699d287f637ea133494448ad09e0911fdec1bcf0c1e055d0ee8b482081`, which is what
makes the "same as the original" claim checkable rather than a claim.

## Verifying the copy

`build.py` proves the bytes. To prove the *behaviour*, start a headless Chrome
with a debugging port and run the A/B harness:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --remote-debugging-port=9333 --user-data-dir=/tmp/holo-cdp &
python3 serve.py 8123 &
node verify.mjs --cdp http://127.0.0.1:9333 --local http://127.0.0.1:8123/
python3 compare_screens.py
```

`verify.mjs` drives both pages through idle → open → replay → mute → open
again, and compares pack class, the five dealt cards (name, rarity, number,
class and bounding box), the "Open another pack" state, the mute toggle and its
`localStorage` value, and the live-region announcement.

Three things make the comparison meaningful:

- **A seeded `Math.random`** is installed via `Page.addScriptToEvaluateOnNewDocument`
  before the page's own scripts run, so both sides draw the same pack colour,
  card order, tear direction and particle jitter.
- **It is reseeded immediately before every interaction.** The animation loop
  consumes `Math.random` once per frame (crumple walk, particle spawns, blink
  and nudge timers), so by the time you click, each page has advanced the stream
  by however many frames it happened to render. Seeding once at load is not
  enough; reseeding at each step is what makes the deal order reproducible.
- **Cloudflare's RUM beacon is blocked.** It is injected by the CDN, not the
  app, and it calls `Math.random` on the deployed page only — leaving it in
  desynchronises the two random streams.

Geometry is compared with a 0.5 px tolerance, because the same page reports
e.g. `200.46` and `200.54` for the pack width on different runs. For the same
reason the screenshots are compared with a noise budget rather than byte
equality: the last run agreed to a mean channel difference of 0.02/255 with
under 0.07 % of pixels differing visibly.

## Behavior notes worth keeping if you edit

- `--spring` is a `linear()` easing with 22 stops; the tear, deal and lift
  animations all depend on it.
- The pouch silhouette is a CSS `mask` built from a `conic-gradient` tooth comb
  plus an inline SVG body path; `--crimp` drives both the mask and the seal ridges.
- The pack's crumple shading is generated per-pack in JS as an SVG turbulence
  layer and injected through the `--shade` custom property.
- Artwork is decoded up front (`warm`) so the first frame of every card already
  has its image; removing that introduces a flash on deal.
- Audio only starts on a real user gesture (`pointerdown`/`keydown`); the mute
  state lives in `localStorage` under `holo-muted`.
- Unseeded randomness (`Math.random`) drives the pack skin variant, the tear
  direction, particle jitter and the synth noise, so pixel-identical screenshots
  between runs are not expected — layout and behavior are.
