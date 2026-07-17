"use client";

import { Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Html, useGLTF, useProgress } from "@react-three/drei";
import {
  Box3,
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  PointLight,
  Vector3,
  type DirectionalLight,
} from "three";
import type { MotionValue } from "framer-motion";

const NEON = new Color("#4dd8ff");
const WARNING = new Color("#ff2020");

export interface ExplodeComponent {
  label: string;
  body: string;
  /** Direction (unit-ish vector) the component flies out along when exploded. */
  dir: [number, number, number];
}

const COMPONENTS: ExplodeComponent[] = [
  { label: "Main Controller", body: "Placeholder — real MCU/board swaps in with the actual model.", dir: [0, 1, 0.3] },
  { label: "MicroROS Node", body: "Placeholder — micro-ROS bridge to the onboard sensors.", dir: [1, 0.2, 0.4] },
  { label: "ROS 2 Bridge", body: "Placeholder — ROS 2 topic bridge to the base station.", dir: [-1, 0.2, 0.4] },
  { label: "Actuator Driver", body: "Placeholder — motor/actuator driver stage.", dir: [0, -0.6, 1] },
];

function Model({
  url,
  progress,
  exploded,
  telemetryAngle,
}: {
  url: string;
  progress: MotionValue<number>;
  exploded: boolean;
  telemetryAngle: React.MutableRefObject<number>;
}) {
  const { scene } = useGLTF(url);
  const group = useRef<Group>(null);
  const explodeT = useRef(0);

  // Clone materials (not the shared cached scene's own materials — Hero's dual-bot display
  // uses this same url/cache) so mutating them for the wireframe/emissive crossfade below can't
  // fight over material state with any other consumer of this url elsewhere on the page.
  const materials = useMemo(() => {
    const mats: MeshStandardMaterial[] = [];
    scene.traverse((obj) => {
      if (obj instanceof Mesh && obj.material instanceof MeshStandardMaterial) {
        obj.material = obj.material.clone();
        obj.material.transparent = true;
        obj.material.emissiveIntensity = 1;
        mats.push(obj.material);
      }
    });
    return mats;
  }, [scene]);

  // drei's <Stage> normally auto-centers/fits models regardless of raw GLTF units — this
  // component hand-rolls lighting instead (per-act dramatic changes Stage doesn't support),
  // so it has to do that centering/fitting itself or the model renders off-frame or invisibly
  // tiny/huge depending on the source file's raw scale.
  const box = useMemo(() => new Box3().setFromObject(scene), [scene]);
  const size = useMemo(() => box.getSize(new Vector3()), [box]);
  const center = useMemo(() => box.getCenter(new Vector3()), [box]);
  const fitScale = useMemo(() => 2.2 / Math.max(size.x, size.y, size.z, 0.0001), [size]);

  useFrame((_, delta) => {
    const p = progress.get();

    // Act 1 (0-0.25): wireframe neon materializes into the solid textured model.
    const materialize = Math.min(Math.max((p - 0.02) / 0.22, 0), 1);
    for (const mat of materials) {
      mat.wireframe = materialize < 0.92;
      mat.opacity = 0.35 + materialize * 0.65;
      mat.emissive.copy(NEON).multiplyScalar((1 - materialize) * 1.6);
    }

    // Act 2 (0.25-0.5): click-to-explode toggle drives a local spring-ish lerp.
    explodeT.current += ((exploded ? 1 : 0) - explodeT.current) * Math.min(delta * 4, 1);

    // Act 3 (0.5-0.75): warning pulses live on the component markers below.

    // Act 4 (0.75-1): gentle telemetry-driven sway once the model is fully assembled.
    if (group.current) {
      const telemetry = p > 0.75 ? telemetryAngle.current : 0;
      group.current.rotation.y = telemetry * 0.15;
    }
  });

  return (
    <group ref={group}>
      <group scale={fitScale} position={[-center.x * fitScale, -center.y * fitScale, -center.z * fitScale]}>
        <primitive object={scene} />
        {COMPONENTS.map((c, i) => (
          <ExplodePart key={c.label} component={c} index={i} explodeT={explodeT} />
        ))}
      </group>
    </group>
  );
}

function ExplodePart({
  component,
  index,
  explodeT,
}: {
  component: ExplodeComponent;
  index: number;
  explodeT: React.MutableRefObject<number>;
}) {
  const ref = useRef<Group>(null);
  const reach = 1.5;
  const home = useMemo(() => new Vector3(0, 0.4 + index * 0.35, 0), [index]);
  const target = useMemo(
    () => home.clone().add(new Vector3(...component.dir).normalize().multiplyScalar(reach)),
    [home, component.dir, reach]
  );

  useFrame(() => {
    if (!ref.current) return;
    const t = explodeT.current;
    ref.current.position.lerpVectors(home, target, t);
    ref.current.scale.setScalar(0.06 + t * 0.02);
  });

  return (
    <group ref={ref} position={home}>
      <mesh>
        <boxGeometry args={[1, 1, 1]} />
        <meshStandardMaterial color="#222" emissive={WARNING} emissiveIntensity={0.15} />
      </mesh>
      {explodeT.current > 0.6 && (
        <Html center distanceFactor={8} zIndexRange={[40, 0]}>
          <div className="sharp-card w-40 rounded-lg p-2 text-center">
            <p className="text-[11px] font-bold text-white">{component.label}</p>
            <p className="mt-0.5 text-[10px] text-white/60">{component.body}</p>
          </div>
        </Html>
      )}
    </group>
  );
}

function WarningMarkers({ progress }: { progress: MotionValue<number> }) {
  const refs = useRef<Mesh[]>([]);
  const positions: [number, number, number][] = [
    [0.35, 1.2, 0.3],
    [-0.35, 0.6, 0.4],
    [0.2, -0.3, 0.5],
  ];

  useFrame(({ clock }) => {
    const p = progress.get();
    const active = p > 0.5 && p < 0.78;
    const pulse = active ? 0.6 + Math.sin(clock.elapsedTime * 6) * 0.5 : 0;
    for (const mesh of refs.current) {
      if (!mesh) continue;
      const mat = mesh.material as MeshStandardMaterial;
      mat.emissiveIntensity = Math.max(pulse, 0);
      mesh.visible = active;
    }
  });

  return (
    <>
      {positions.map((pos, i) => (
        <mesh key={i} ref={(el) => { if (el) refs.current[i] = el; }} position={pos}>
          <sphereGeometry args={[0.04, 12, 12]} />
          <meshStandardMaterial color={WARNING} emissive={WARNING} emissiveIntensity={0} />
        </mesh>
      ))}
    </>
  );
}

function LoaderOverlay() {
  const { active, progress } = useProgress();
  if (!active) return null;

  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-black/40">
      <div className="sharp-card w-56 rounded-xl p-4 text-center">
        <p className="mb-2 text-xs text-white/60">Loading build story...</p>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
          <div className="h-full bg-red transition-all" style={{ width: `${Math.round(progress)}%` }} />
        </div>
      </div>
    </div>
  );
}

function Lighting({ progress }: { progress: MotionValue<number> }) {
  const key = useRef<DirectionalLight>(null);
  const fill = useRef<PointLight>(null);

  useFrame(() => {
    const p = progress.get();
    if (key.current) {
      // Act 3 dims to dramatic shadow, Act 4 brightens to arena floodlights.
      if (p < 0.5) key.current.intensity = 1.1;
      else if (p < 0.75) key.current.intensity = 0.35;
      else key.current.intensity = 1.8;
      key.current.color.set(p >= 0.5 && p < 0.75 ? "#5533aa" : "#ffffff");
    }
    if (fill.current) {
      fill.current.intensity = p >= 0.75 ? 1.4 : 0.4;
    }
  });

  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight ref={key} position={[3, 4, 5]} />
      <pointLight ref={fill} position={[-3, 2, 3]} color="#ffcc88" />
    </>
  );
}

export default function BuildStoryStage({
  url,
  progress,
  exploded,
  telemetryAngle,
}: {
  url: string;
  progress: MotionValue<number>;
  exploded: boolean;
  telemetryAngle: React.MutableRefObject<number>;
}) {
  useEffect(() => {
    return () => {
      useGLTF.clear(url);
    };
  }, [url]);

  return (
    <div className="relative h-full w-full">
      <Canvas
        camera={{ fov: 40, position: [0, 0.2, 5] }}
        dpr={[1, 2]}
        gl={{ antialias: true, powerPreference: "high-performance" }}
      >
        <Lighting progress={progress} />
        <Suspense fallback={null}>
          <WarningMarkers progress={progress} />
          <Model url={url} progress={progress} exploded={exploded} telemetryAngle={telemetryAngle} />
        </Suspense>
      </Canvas>
      <LoaderOverlay />
    </div>
  );
}
