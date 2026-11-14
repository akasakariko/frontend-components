# Bloom

A standalone WebGPU 3D blooming flower scene reconstructed from [bloooooom.vercel.app/bloom](https://bloooooom.vercel.app/bloom), stripped down to the pure 3D flower canvas without surrounding portfolio chrome.

## Features

- **Procedural TSL Petal Deformation**: 128 instanced petals deformed in Three.js Shading Language (`scale`, `rotate`, `bend`, `remap`) with dynamic finite-difference normal recomputation and `MeshStandardNodeMaterial`.
- **WebGPU Compute Pointer Trail**: Ping-pong `StorageTexture` compute shader (`PointerTrail`) driving subtle screen-space UV distortion in `PostProcessing`.
- **Twinkling Particle Field**: GPU-initialized `instancedArray` + `SpriteNodeMaterial` star/pollen particles oscillating with `oscSine`.
- **GSAP Bloom Sequence & Parallax**: Intro timeline animating flower rotation, bloom progress, and camera depth alongside smooth pointer parallax.

## Stack

- Next.js 15 / React 19
- React Three Fiber / Drei
- Three.js (`three/webgpu` & `three/tsl`)
- GSAP & Zustand
- Tailwind CSS v4

## Local Development

```bash
cd bloom
npm install
npm run dev
```

Open <http://localhost:3000> (or <http://localhost:3000/bloom>) in a WebGPU-capable browser.
