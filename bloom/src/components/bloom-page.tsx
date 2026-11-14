"use client";

import React, { Suspense, useEffect, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import {
  Environment,
  Loader,
  useFBO,
  useGLTF,
  useProgress,
} from "@react-three/drei";
import {
  DoubleSide,
  HalfFloatType,
  InstancedMesh,
  MathUtils,
  Object3D,
  SRGBColorSpace,
  Vector2,
} from "three";
import {
  Fn,
  If,
  abs,
  clamp,
  color,
  cos,
  cross,
  distance,
  div,
  dot,
  float,
  frontFacing,
  instanceIndex,
  int,
  length,
  mat3,
  mat4,
  mix,
  mod,
  mul,
  negate,
  normalLocal,
  normalView,
  normalize,
  oneMinus,
  positionLocal,
  remap,
  saturate,
  sin,
  step,
  sub,
  texture,
  textureStore,
  time,
  uniform,
  uv,
  vec2,
  vec3,
  vec4,
} from "three/tsl";
import {
  MeshBasicNodeMaterial,
  MeshStandardNodeMaterial,
  StorageTexture,
} from "three/webgpu";
import { FullScreenQuad } from "three-stdlib";
import { create } from "zustand";
import gsap from "gsap";
import { DrawSVGPlugin } from "gsap/DrawSVGPlugin";
import { useGSAP } from "@gsap/react";
import { WebGPUCanvas } from "@/components/webgpu-canvas";
import { Particles } from "@/components/particles";

gsap.registerPlugin(DrawSVGPlugin);

const scale = Fn(([position, scaleFactor]: [any, any]) => {
  const s = vec3(scaleFactor).toVar();
  const p = vec3(position).toVar();
  const m = mat4(1).toVar();
  m.element(int(0)).element(int(0)).assign(s.x);
  m.element(int(1)).element(int(1)).assign(s.y);
  m.element(int(2)).element(int(2)).assign(s.z);
  return m.mul(vec4(p, 1));
}).setLayout({
  name: "scale",
  type: "vec4",
  inputs: [
    { name: "position", type: "vec3" },
    { name: "scaleFactor", type: "vec3" },
  ],
});

const rotate = Fn(([position, axis, angle]: [any, any, any]) => {
  const a = float(angle).toVar();
  const r = vec3(axis).toVar();
  const pos = vec3(position).toVar();
  r.assign(normalize(r));
  const l = float(sin(a)).toVar();
  const o = float(cos(a)).toVar();
  const u = float(sub(1, o)).toVar();
  return mat3(
    u.mul(r.x).mul(r.x).add(o),
    u.mul(r.x).mul(r.y).sub(r.z.mul(l)),
    u.mul(r.z).mul(r.x).add(r.y.mul(l)),
    u.mul(r.x).mul(r.y).add(r.z.mul(l)),
    u.mul(r.y).mul(r.y).add(o),
    u.mul(r.y).mul(r.z).sub(r.x.mul(l)),
    u.mul(r.z).mul(r.x).sub(r.y.mul(l)),
    u.mul(r.y).mul(r.z).add(r.x.mul(l)),
    u.mul(r.z).mul(r.z).add(o)
  )
    .toVar()
    .mul(pos);
}).setLayout({
  name: "rotate",
  type: "vec3",
  inputs: [
    { name: "position", type: "vec3" },
    { name: "axis", type: "vec3" },
    { name: "angle", type: "float" },
  ],
});

const bend = Fn(([r_co, factor, axis, dcut, origin]: [any, any, any, any, any]) => {
  const a = vec3(origin).toVar();
  const l = vec3(dcut).toVar();
  const o = int(axis).toVar();
  const u = float(factor).toVar();
  const d = vec3(r_co).toVar();
  const c = float(d.x).toVar();
  const h = float(d.y).toVar();
  const g = float(d.z).toVar();
  const x = float().toVar();
  const p = float().toVar();
  const f = float().toVar();

  If(abs(u).lessThan(1e-5), () => d);

  d.subAssign(a);
  c.assign(d.x);
  h.assign(d.y);
  g.assign(d.z);

  If(o.equal(int(0)).or(o.equal(int(1))), () => {
    x.assign(g.mul(u));
  }).Else(() => {
    x.assign(c.mul(u));
  });

  p.assign(sin(x));
  f.assign(cos(x));

  If(o.equal(int(0)), () => {
    d.x.assign(c);
    d.y.assign(h.mul(f).add(sub(1, f).div(u)));
    d.z.assign(h.sub(div(1, u)).negate().mul(p));
    d.x.addAssign(l.x);
    d.y.addAssign(p.mul(l.z));
    d.z.addAssign(f.mul(l.z));
  })
    .ElseIf(o.equal(int(1)), () => {
      d.x.assign(c.mul(f).add(sub(1, f).div(u)));
      d.y.assign(h);
      d.z.assign(c.sub(div(1, u)).negate().mul(p));
      d.x.addAssign(p.mul(l.z));
      d.y.addAssign(l.y);
      d.z.addAssign(f.mul(l.z));
    })
    .Else(() => {
      d.x.assign(h.sub(div(1, u)).negate().mul(p));
      d.y.assign(h.mul(f).add(sub(1, f).div(u)));
      d.z.assign(g);
      d.x.addAssign(f.mul(l.x));
      d.y.addAssign(p.mul(l.x));
      d.z.addAssign(l.z);
    });

  d.addAssign(a);
  return d;
}).setLayout({
  name: "bend",
  type: "vec3",
  inputs: [
    { name: "r_co", type: "vec3" },
    { name: "factor", type: "float" },
    { name: "axis", type: "int" },
    { name: "dcut", type: "vec3" },
    { name: "origin", type: "vec3" },
  ],
});

const useObject = (...objects: any[]) => {
  const { scene } = useThree();
  useEffect(() => {
    if (objects && objects.length) {
      const valid = objects.filter((o) => o !== null);
      if (valid.length !== 0) {
        scene.add(...valid);
        return () => {
          scene.remove(...valid);
        };
      }
    }
  }, [objects, scene]);
  return null;
};

const useLoadingStore = create<{
  isLoading: boolean;
  setIsLoading: (isLoading: boolean) => void;
}>((set) => ({
  isLoading: false,
  setIsLoading: (isLoading) => set({ isLoading }),
}));

const sdSegment = Fn(({ p, a, b }: { p: any; a: any; b: any }) => {
  const n = p.sub(a);
  const r = b.sub(a);
  const h = clamp(dot(n, r).div(dot(r, r)));
  return n.sub(r.mul(h)).length();
});

const indexToCoord = Fn(({ index, width }: { index: any; width: any }) => {
  const x = int(index).mod(int(width));
  const y = int(index).div(int(width));
  return vec2(x, y);
});

const coordToUV = Fn(
  ({ st, width, height }: { st: any; width: any; height: any }) => {
    return vec2(float(st.x).div(float(width)), float(st.y).div(float(height)));
  }
);

class PointerTrail {
  brushSize = 0.08;
  fadingRate = 0.9;
  phase = true;
  width: number;
  height: number;
  renderer: any;
  pingTexture: StorageTexture;
  pongTexture: StorageTexture;
  uniforms: any;
  computePingPongTSL: any;
  computeToPong: any;
  computeToPing: any;
  updatePointer: (pos: Vector2) => void;
  setIsPointerEnter: (val: boolean) => void;
  update: () => void;

  resize(width: number, height: number) {
    if (width === this.width && height === this.height) return;
    this.pingTexture.dispose();
    this.pongTexture.dispose();
    this.width = width;
    this.height = height;
    this.pingTexture = new StorageTexture(width, height);
    this.pongTexture = new StorageTexture(width, height);
    this.pingTexture.type = HalfFloatType;
    this.pongTexture.type = HalfFloatType;
    this.computeToPong = this.computePingPongTSL({
      readTex: this.pingTexture,
      writeTex: this.pongTexture,
      index: instanceIndex,
    }).compute(width * height);
    this.computeToPing = this.computePingPongTSL({
      readTex: this.pongTexture,
      writeTex: this.pingTexture,
      index: instanceIndex,
    }).compute(width * height);

    const clearCompute = Fn(
      ({ writeTex, index }: { writeTex: any; index: any }) => {
        const coord = indexToCoord({ index, width });
        textureStore(writeTex, coord, vec4(0, 0, 0, 1));
      }
    )({ writeTex: this.pingTexture, index: instanceIndex }).compute(
      width * height
    );
    this.renderer.computeAsync(clearCompute);
  }

  get resultTexture() {
    return this.uniforms.resultTexture;
  }

  constructor(renderer: any, width: number, height: number) {
    this.width = width;
    this.height = height;
    this.renderer = renderer;
    this.pingTexture = new StorageTexture(width, height);
    this.pongTexture = new StorageTexture(width, height);
    this.pingTexture.type = HalfFloatType;
    this.pongTexture.type = HalfFloatType;

    this.uniforms = {
      resultTexture: this.pongTexture,
      pointerPosition: uniform(vec2(0)),
      lastPointerPosition: uniform(vec2(0)),
      isPointerEnter: uniform(0),
      lastIsPointerEnter: uniform(0),
      diff: uniform(0),
    };

    this.computePingPongTSL = Fn(
      ({
        readTex,
        writeTex,
        index,
      }: {
        readTex: any;
        writeTex: any;
        index: any;
      }) => {
        const n = indexToCoord({ index, width: this.width });
        const r = coordToUV({
          st: n.add(vec2(float(0.5), float(0.5))),
          width: this.width,
          height: this.height,
        });
        const a = texture(readTex, r);
        const l = this.uniforms.lastPointerPosition;
        const o = this.uniforms.pointerPosition;
        const u = float(this.width).div(this.height);
        const d = vec2(r.x.mul(u), r.y);
        const c = vec2(o.x.mul(u), o.y);
        const h = vec2(l.x.mul(u), l.y);
        const g = step(this.brushSize, distance(d, c)).oneMinus();
        const x = sdSegment({ p: d, a: h, b: c });
        const p = c.sub(h);
        const f = saturate(dot(d.sub(h), p).div(dot(p, p)));
        const v = step(this.brushSize, x).oneMinus();
        const y = vec4(0).toVar();
        const w = float(this.uniforms.lastIsPointerEnter).sub(
          this.uniforms.isPointerEnter
        );
        const j = v.mul(
          f.mul(float(this.fadingRate).oneMinus()).add(this.fadingRate)
        );
        const b = a.mul(this.fadingRate);

        If(
          w.lessThan(-0.1),
          Fn(() => {
            y.assign(mix(b, vec4(this.uniforms.isPointerEnter, 0, 0, 1), g));
          })
        ).Else(
          Fn(() => {
            y.assign(mix(b, vec4(this.uniforms.isPointerEnter, 0, 0, 1), j));
          })
        );

        const T = float(this.uniforms.diff);
        const V = float(this.uniforms.isPointerEnter).mul(step(0.001, T));
        const P = mix(b, y, V);
        textureStore(writeTex, n, vec4(vec3(P), 1));
      }
    );

    this.updatePointer = (pos: Vector2) => {
      this.uniforms.pointerPosition.value.copy(pos);
      const delta = pos.clone().sub(this.uniforms.lastPointerPosition.value);
      this.uniforms.diff.value = delta.length();
    };

    this.setIsPointerEnter = (val: boolean) => {
      this.uniforms.isPointerEnter.value = +!!val;
    };

    this.update = () => {
      if (this.computeToPing && this.computeToPong) {
        this.renderer.computeAsync(
          this.phase ? this.computeToPong : this.computeToPing
        );
        this.uniforms.resultTexture = this.phase
          ? this.pongTexture
          : this.pingTexture;
        this.phase = !this.phase;
      }
      this.uniforms.lastPointerPosition.value =
        this.uniforms.pointerPosition.value.clone();
      this.uniforms.lastIsPointerEnter.value = 1;
    };

    this.computeToPong = this.computePingPongTSL({
      readTex: this.pingTexture,
      writeTex: this.pongTexture,
      index: instanceIndex,
    }).compute(width * height);
    this.computeToPing = this.computePingPongTSL({
      readTex: this.pongTexture,
      writeTex: this.pingTexture,
      index: instanceIndex,
    }).compute(width * height);

    const initCompute = Fn(
      ({ writeTex, index }: { writeTex: any; index: any }) => {
        const coord = indexToCoord({ index, width });
        textureStore(writeTex, coord, vec4(0, 0, 0, 1));
      }
    )({ writeTex: this.pingTexture, index: instanceIndex }).compute(
      width * height
    );
    renderer.computeAsync(initCompute);
  }
}

function Stem(props: any) {
  const { nodes } = useGLTF("/stem.glb") as any;
  useMemo(
    () => new MeshStandardNodeMaterial({ roughness: 0.5, color: "#ffffff" }),
    []
  );
  return (
    <group {...props} dispose={null} name="stem">
      <group scale={0.01}>
        <mesh
          castShadow
          receiveShadow
          geometry={nodes.Stem2_Material005_0.geometry}
          material={nodes.Stem2_Material005_0.material}
          position={[-3.315, 389.017, -1.631]}
          rotation={[-1.396, 0.041, -0.126]}
          scale={[11.36, 11.36, 6.635]}
        />
      </group>
    </group>
  );
}

const Flower = () => {
  const { scene, camera } = useThree();
  const { isLoading, setIsLoading } = useLoadingStore();
  const { nodes, materials } = useGLTF("/pp.glb") as any;
  const mat = materials["Iris and blye.002"];
  const { active } = useProgress();

  useEffect(() => {
    if (!active) setIsLoading(false);
  }, [active, setIsLoading]);

  const { instancedMesh, uniforms } = useMemo(() => {
    const mapTex = mat.map;
    if (mapTex) mapTex.colorSpace = SRGBColorSpace;
    const uProgress = uniform(float(0));
    const uStartProgess = uniform(float(0));

    const deform = Fn(([t]: [any]) => {
      const i = float(instanceIndex).div(64).mul(6);
      const n = mod(time.add(i), 6).div(6);
      const r = remap(uStartProgess, 0, 1, 1, -2);
      const a = float(
        remap(n, 0, 1, mul(2, 3.14159), mul(r, 3.14159))
      ).toVar();
      const l = remap(
        uStartProgess,
        0,
        1,
        vec3(0.8, 0.01, 0.3),
        vec3(0.8, 0.7, 0.4)
      );
      t.assign(scale(t, vec3(l)).xyz);
      t.assign(bend(t, a, int(2), vec3(int(0), 0, 0), vec3(0, 0, int(0))));
      t.assign(scale(t, vec3(remap(n, 0, 0.5, 0, 1))).xyz);
      t.assign(scale(t, vec3(remap(n, 0.5, 1, 0.8, 0.2))).xyz);
      t.assign(
        rotate(t, vec3(0, 1, 0), mul(mul(3.14159, -0.3), uStartProgess)).xyz
      );
      return t;
    });

    // eslint-disable-next-line prefer-const
    let nodeMaterial: MeshStandardNodeMaterial;
    nodeMaterial = new MeshStandardNodeMaterial({
      side: DoubleSide,
      normalMap: mat.normalMap,
      roughnessMap: mat.roughnessMap,
      metalnessMap: mat.metalnessMap,
      map: mat.map,
      emissiveMap: mat.emissiveMap,
      colorNode: Fn(() => {
        const e = color("#000");
        const t = float(clamp(uv().x.mul(length(positionLocal))));
        vec3(mix(e, vec3(1), clamp(t)));
        If(frontFacing, () => {
          normalView.assign(negate(normalView));
        }).Else(() => {
          normalView.assign(normalView);
        });
        return mix(
          0,
          texture(nodeMaterial.map!),
          clamp(0, 1, uStartProgess.mul(2))
        );
      })(),
      positionNode: Fn(() => {
        const e = deform(positionLocal).toVar("pos");
        const t = vec2(0.01, 0).toVar("shift");
        const s = vec3(deform(positionLocal.add(t.yyx))).toVar("pos2");
        const n = vec3(deform(positionLocal.add(t.xyy))).toVar("pos3");
        const r = normalize(
          cross(normalize(s.sub(e)), normalize(n.sub(e)))
        ).toVar("objectNormal");
        normalLocal.assign(r);
        return e;
      })(),
    });

    const mesh = new InstancedMesh(nodes.Circle003.geometry, nodeMaterial, 128);
    return {
      material: nodeMaterial,
      instancedMesh: mesh,
      uniforms: { uProgress, uStartProgess },
    };
  }, [mat, nodes]);

  useGSAP(() => {
    if (isLoading) return;
    const s = scene.getObjectByName("group");
    if (!s) return;
    gsap
      .timeline()
      .to(s.rotation, { y: -Math.PI / 2, duration: 1.5 })
      .to(uniforms.uStartProgess, { value: 1, delay: 0.5, duration: 5.5 }, 0)
      .from(camera.position, { z: 0, duration: 2 }, 0);
  }, [isLoading, uniforms.uProgress]);

  useObject(instancedMesh, instancedMesh);

  useMemo(() => {
    const dummy = new Object3D();
    Array.from({ length: 128 }).forEach((_, idx) => {
      dummy.rotation.set(0, MathUtils.degToRad(140 * idx), 0);
      dummy.updateMatrix();
      instancedMesh?.setMatrixAt(idx, dummy.matrix);
    });
  }, [instancedMesh]);

  useFrame((state) => {
    state.camera.position.lerp(
      { x: -(0.3 * state.pointer.x), y: 2, z: 2 } as any,
      0.05
    );
  });

  return null;
};

const PostProcessing = () => {
  const fbo = useFBO();
  const { gl, size } = useThree();
  const trail = useMemo(
    () => new PointerTrail(gl, window.innerWidth, window.innerHeight),
    [gl]
  );

  useEffect(() => {
    trail.resize(size.width, size.height);
  }, [size.width, size.height, trail]);

  const quad = useMemo(
    () =>
      new FullScreenQuad(
        new MeshBasicNodeMaterial({
          transparent: true,
          colorNode: Fn(() => {
            const t = texture(trail.resultTexture);
            return texture(
              fbo.texture,
              vec2(uv().x.add(t.x.mul(0.05)), oneMinus(uv().y))
            );
          })(),
        })
      ),
    [trail.resultTexture, fbo.texture]
  );

  useFrame((state) => {
    const { camera, gl, scene, pointer } = state;
    const o = new Vector2(0.5 * pointer.x + 0.5, 0.5 * pointer.y + 0.5);
    trail.updatePointer(o);
    trail.update();
    trail.setIsPointerEnter(true);
    gl.setRenderTarget(fbo);
    gl.render(scene, camera);
    gl.setRenderTarget(null);
    quad.render(gl);
  }, 1);

  return null;
};

export function BloomPage() {
  return (
    <div className="relative h-screen select-none overflow-hidden from-black to-[#8386ff] bg-gradient-to-b">
      <Loader />
      <WebGPUCanvas
        className="absolute inset-0 top-0 left-0 h-screen"
        camera={{ position: [0, 2, 2], zoom: 2.5 }}
      >
        <Suspense fallback={null}>
          <PostProcessing />
          <Environment
            environmentRotation={[0, -Math.PI / 1.5, 0]}
            blur={2}
            environmentIntensity={0.5}
            files="/dawn.hdr"
          />
          <Particles />
          <group name="group">
            <Stem position={[-0, -3.3, -0.03]} scale={[0.8, 0.8, 0.8]} />
            <Flower />
          </group>
        </Suspense>
      </WebGPUCanvas>
    </div>
  );
}
