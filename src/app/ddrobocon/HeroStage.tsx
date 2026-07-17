"use client";

import { Component, Suspense, useEffect, useMemo, useRef, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Clone, Stage, useGLTF, useProgress } from "@react-three/drei";
import { Box3, Vector3, type Group } from "three";
import type { MotionValue } from "framer-motion";

function Duo({
  url,
  spin,
  drag,
  lean,
}: {
  url: string;
  spin?: MotionValue<number>;
  drag?: MotionValue<number>;
  lean?: MotionValue<number>;
}) {
  const { scene } = useGLTF(url);
  const left = useRef<Group>(null);
  const right = useRef<Group>(null);

  // Model units vary wildly between .glb exports; space the pair from the measured size.
  const dx = useMemo(() => {
    const size = new Box3().setFromObject(scene).getSize(new Vector3());
    return Math.max(size.x, size.z, size.y * 0.45) * 0.85;
  }, [scene]);

  useFrame(({ clock }) => {
    const scrollTurn = spin ? spin.get() * Math.PI * 2 : 0;
    const dragTurn = drag ? drag.get() : 0;
    const cursorLean = lean ? lean.get() * 0.35 : 0;
    const idle = clock.getElapsedTime() * 0.15;
    if (left.current) left.current.rotation.y = idle + scrollTurn + dragTurn + cursorLean;
    if (right.current) right.current.rotation.y = -idle - scrollTurn + dragTurn + cursorLean;
  });

  return (
    <group>
      <group ref={left} position={[-dx, 0, 0]}>
        <Clone object={scene} />
      </group>
      <group ref={right} position={[dx, 0, 0]}>
        <Clone object={scene} />
      </group>
    </group>
  );
}

function LoaderOverlay() {
  const { active, progress } = useProgress();
  if (!active) return null;

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
      <div className="sharp-card w-56 rounded-xl p-4 text-center">
        <p className="mb-2 text-xs text-white/60">Loading bots...</p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-red transition-all" style={{ width: `${Math.round(progress)}%` }} />
        </div>
      </div>
    </div>
  );
}

class SceneErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export default function HeroStage({
  url,
  spin,
  drag,
  lean,
}: {
  url: string;
  spin?: MotionValue<number>;
  drag?: MotionValue<number>;
  lean?: MotionValue<number>;
}) {
  useEffect(() => {
    return () => {
      useGLTF.clear(url);
    };
  }, [url]);

  return (
    <div className="relative h-full w-full">
      <Canvas
        camera={{ fov: 40, position: [0, 0, 6] }}
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <SceneErrorBoundary>
          <Suspense fallback={null}>
            <Stage environment="city" intensity={0.7} shadows="contact" adjustCamera={1.15}>
              <Duo url={url} spin={spin} drag={drag} lean={lean} />
            </Stage>
          </Suspense>
        </SceneErrorBoundary>
      </Canvas>
      <LoaderOverlay />
    </div>
  );
}
