# Glass Light Toggle

An interactive light/dark theme toggle featuring a frosted-glass knob rendered in a single WebGL2 fragment shader with a spring-driven pixel matrix behind it.

Inspired by Zsolt Kacso's [Glass Light Toggle](https://experiments.thisiswhitespace.com/glass-light-toggle) experiment.

## Features

- **Single-pass WebGL2 glass shader**: Signed-distance rounded-box track and knob, edge-bevel refraction, RGB chromatic aberration, radial bevel frost, total internal reflection along the rim, and top-left specular highlights.
- **Orbiting edge light**: Smoothly transitions between cool blue (`#6f86ff`) in dark mode and warm amber (`#ffa82e`) in light mode, orbiting around the knob perimeter while casting floor wash and page spill.
- **Spring-driven pixel morph**: 17x17 pixel matrix pairing every moon/star pixel with sun/ray pixels by sweep angle, driven by per-pixel damped springs, swirl arcs, and velocity drag.
- **Full pointer & keyboard support**: Click anywhere on the track, drag with velocity throw and rubber-band overdrag, or press `Space`, `Enter`, `ArrowLeft`, or `ArrowRight`.

## Usage

Open `index.html` directly in a modern browser, or integrate via the exposed helper and `themechange` event:

```js
window.addEventListener('themechange', (event) => {
  console.log('Theme changed:', event.detail.theme); // 'light' | 'dark'
});

window.GlassLightToggle.setTheme('light');
```
