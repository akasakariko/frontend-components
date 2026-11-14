"use client";

import React from "react";
import { Canvas, extend, type CanvasProps } from "@react-three/fiber";
import * as THREE_WEBGPU from "three/webgpu";

extend(THREE_WEBGPU as any);

export const WebGPUCanvas = ({ children, ...props }: CanvasProps) => {
  return (
    <Canvas
      {...props}
      flat
      gl={async (canvasProps) => {
        const renderer = new THREE_WEBGPU.WebGPURenderer(canvasProps as any);
        await renderer.init();
        return renderer;
      }}
    >
      {children}
    </Canvas>
  );
};
