"use client";

import { Component, Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, OrbitControls, Stage, useGLTF, useProgress } from "@react-three/drei";
import { Box3, Vector3, type Group } from "three";
import type { MotionValue } from "framer-motion";

export interface BotHotspot {
  /** Position as fractions (0-1) of the model's bounding box on each axis — survives unit-scale differences between .glb files. */
  f: [number, number, number];
  label: string;
  body?: string;
}

function Model({
  url,
  spin,
  hotspots,
  activeHotspot,
  onHotspotClick,
}: {
  url: string;
  spin?: MotionValue<number>;
  hotspots?: BotHotspot[];
  activeHotspot: number | null;
  onHotspotClick: (index: number) => void;
}) {
  const { scene } = useGLTF(url);
  const group = useRef<Group>(null);

  const pins = useMemo(() => {
    if (!hotspots?.length) return [];
    const box = new Box3().setFromObject(scene);
    const size = box.getSize(new Vector3());
    return hotspots.map((h) => ({
      ...h,
      position: new Vector3(
        box.min.x + h.f[0] * size.x,
        box.min.y + h.f[1] * size.y,
        box.min.z + h.f[2] * size.z
      ),
    }));
  }, [scene, hotspots]);

  useFrame(() => {
    if (group.current && spin) {
      group.current.rotation.y = spin.get() * Math.PI * 2;
    }
  });

  return (
    <group ref={group}>
      <primitive object={scene} />
      {pins.map((pin, i) => (
        <Html key={pin.label} position={pin.position} center zIndexRange={[50, 0]}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onHotspotClick(i);
            }}
            aria-label={`Hotspot: ${pin.label}`}
            className={`flex h-6 w-6 items-center justify-center rounded-full border text-[11px] font-bold transition ${
              activeHotspot === i
                ? "border-red bg-red text-white"
                : "border-white/40 bg-black/60 text-white/80 hover:border-red hover:text-red"
            }`}
          >
            {i + 1}
          </button>
        </Html>
      ))}
    </group>
  );
}

function LoaderOverlay() {
  const { active, progress } = useProgress();
  if (!active) return null;

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
      <div className="sharp-card w-56 rounded-xl p-4 text-center">
        <p className="mb-2 text-xs text-white/60">Loading model...</p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-red transition-all" style={{ width: `${Math.round(progress)}%` }} />
        </div>
      </div>
    </div>
  );
}

class ModelErrorBoundary extends Component<{ children: ReactNode; onError: () => void }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch() {
    this.props.onError();
  }

  render() {
    if (this.state.hasError) return null;
    return this.props.children;
  }
}

export default function BotViewer({
  url,
  autoRotate,
  onError,
  spin,
  hotspots,
}: {
  url: string;
  autoRotate: boolean;
  onError: () => void;
  /** Scroll progress (0-1) that drives model rotation; overrides autoRotate when set. */
  spin?: MotionValue<number>;
  hotspots?: BotHotspot[];
}) {
  const [activeHotspot, setActiveHotspot] = useState<number | null>(null);

  useEffect(() => {
    return () => {
      useGLTF.clear(url);
    };
  }, [url]);

  const active = activeHotspot != null && hotspots ? hotspots[activeHotspot] : null;

  return (
    <div className="relative h-full w-full">
      <Canvas
        camera={{ fov: 40, position: [0, 0, 5] }}
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <ModelErrorBoundary onError={onError}>
          <Suspense fallback={null}>
            <Stage environment="city" intensity={0.7} shadows="contact" adjustCamera={1.2}>
              <Model
                url={url}
                spin={spin}
                hotspots={hotspots}
                activeHotspot={activeHotspot}
                onHotspotClick={(i) => setActiveHotspot((prev) => (prev === i ? null : i))}
              />
            </Stage>
            <OrbitControls autoRotate={autoRotate && !spin} autoRotateSpeed={1.2} enablePan={false} makeDefault />
          </Suspense>
        </ModelErrorBoundary>
      </Canvas>
      <LoaderOverlay />
      {active && (
        <div className="sharp-card absolute bottom-3 left-3 z-10 max-w-xs rounded-xl p-4">
          <p className="text-sm font-bold text-white">{active.label}</p>
          {active.body && <p className="mt-1 text-xs text-white/60">{active.body}</p>}
        </div>
      )}
    </div>
  );
}
