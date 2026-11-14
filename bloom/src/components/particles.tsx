"use client";

import React, { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import {
  Fn,
  If,
  float,
  hash,
  instanceIndex,
  instancedArray,
  oscSine,
  time,
  vec3,
} from "three/tsl";
import { SpriteNodeMaterial } from "three/webgpu";

export interface ParticlesProps {
  x?: number;
  y?: number;
  z?: number;
  width?: number;
  height?: number;
  flashTime?: number;
  particleSize?: number;
}

export const Particles = ({
  x = 20,
  y = 20,
  z = 20,
  width = 20,
  height = 20,
  flashTime = 1,
  particleSize = 0.01,
}: ParticlesProps) => {
  const { gl } = useThree() as any;
  const count = width * height;

  const { particleMaterial } = useMemo(() => {
    const positionBuffer = instancedArray(count, "vec3");
    const velocityBuffer = instancedArray(count, "vec3");
    const colorBuffer = instancedArray(count, "vec3");
    const scaleBuffer = instancedArray(count, "float");

    const computeInit = Fn(() => {
      const position = positionBuffer.element(instanceIndex);
      const color = colorBuffer.element(instanceIndex);

      scaleBuffer.element(instanceIndex).assign(hash(instanceIndex));

      const randX = hash(instanceIndex);
      const randY = hash(instanceIndex.add(2));
      const randZ = hash(instanceIndex.add(3));

      position.x = randX.mul(x).add(-x / 2);
      position.y = randY.mul(y).add(-y / 2);
      position.z = randZ.mul(z).add(-z / 2);

      color.assign(vec3(randX, randY, randZ));
    })().compute(count);

    gl.computeAsync(computeInit);

    const computeUpdate = Fn(() => {
      const position = positionBuffer.element(instanceIndex);
      const velocity = velocityBuffer.element(instanceIndex);

      velocity.addAssign(vec3(0, -0.0098, 0));
      position.addAssign(velocity);

      If(position.y.lessThan(0), () => {
        position.y = float(0);
        velocity.y = velocity.y.negate().mul(1);
      });
    });

    const material = new SpriteNodeMaterial();
    material.colorNode = Fn(() =>
      oscSine(time.mul(scaleBuffer.element(instanceIndex)).mul(flashTime))
    )();
    material.positionNode = positionBuffer.element(instanceIndex);

    return {
      computeUpdate,
      particleMaterial: material,
    };
  }, [gl, count, x, y, z, flashTime]);

  return (
    <mesh count={count} material={particleMaterial}>
      <circleGeometry args={[particleSize]} />
    </mesh>
  );
};
