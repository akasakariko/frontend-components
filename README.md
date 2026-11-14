# Frontend Components

A curated collection of interactive frontend UI components and WebGL experiments.

## Components

| Component | Description | Stack |
| --- | --- | --- |
| [glass-light-toggle](./glass-light-toggle) | Frosted-glass theme toggle with an orbiting edge LED, bevel refraction, chromatic aberration, and spring-animated pixel morphing from moon to sun | HTML, WebGL2, Canvas 2D |
| [holo-card-pack](./holo-card-pack) | Tear-open holographic card pack: CSS 3D pouch with a crimped heat seal, five dealt character cards with foil and parallax, particle FX, and a Web Audio synth for the tear and chimes | HTML, CSS 3D, Web Audio |
| [bloom](./bloom) | Standalone WebGPU 3D blooming flower with procedural TSL petal bending, compute-shader pointer trail, HDR environment lighting, and twinkling particles | Next.js, Three.js WebGPU, TSL, GSAP |

## Local Preview

Serve the repository over HTTP (or open a component's `index.html` directly in a WebGL2-capable browser):

```bash
python3 -m http.server 8080
```

Then open <http://localhost:8080/glass-light-toggle/> or
<http://localhost:8080/holo-card-pack/>. Each component folder is self-contained
and opens directly from the filesystem too.

## Verification

Components that are reconstructions of a shipped page carry their own harness
rather than a claim. `holo-card-pack` is a byte-exact split of the deployed
artifact — `python3 build.py` reassembles `index.html` and fails unless the
SHA-256 matches — plus `verify.mjs`, a headless A/B that drives this copy and the
live page through the same seeded interactions and compares the DOM, layout and
screenshots. See its [README](./holo-card-pack/README.md).
