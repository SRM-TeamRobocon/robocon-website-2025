"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  motion,
  useInView,
  useMotionValueEvent,
  useReducedMotion,
  useScroll,
  useTransform,
} from "framer-motion";
import { MousePointerClick } from "lucide-react";

const BuildStoryStage = dynamic(() => import("./BuildStoryStage"), { ssr: false, loading: () => null });

const ACTS = [
  { roman: "I", title: "The Blueprint", caption: "A neon wireframe materializes into the finished bot." },
  { roman: "II", title: "Building the Brain", caption: "Click the model to expand its subsystems." },
  { roman: "III", title: "The Midnight Crisis", caption: "Warning telemetry flags a fault mid-build." },
  { roman: "IV", title: "The Arena", caption: "Floodlights up. Live telemetry drives the bot." },
];

function useTelemetry(active: boolean) {
  const [reading, setReading] = useState({ speed: 0, current: 0, angle: 0 });
  const angleRef = useRef(0);

  useEffect(() => {
    if (!active) return;
    const start = performance.now();
    const id = window.setInterval(() => {
      const t = (performance.now() - start) / 1000;
      const speed = 1.4 + Math.sin(t * 1.3) * 0.6 + Math.random() * 0.15;
      const current = 2.1 + Math.cos(t * 0.9) * 0.4 + Math.random() * 0.1;
      const angle = Math.sin(t * 0.7) * 35;
      angleRef.current = angle;
      setReading({ speed, current, angle });
    }, 180);
    return () => window.clearInterval(id);
  }, [active]);

  return { reading, angleRef };
}

export default function BuildStory({ modelUrl }: { modelUrl?: string }) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const [exploded, setExploded] = useState(false);
  const [actIndex, setActIndex] = useState(0);

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });
  const captionOpacity = useTransform(scrollYProgress, [0.02, 0.06], [0, 1]);
  const isNearView = useInView(sectionRef, { margin: "50% 0px 50% 0px" });

  useMotionValueEvent(scrollYProgress, "change", (p) => {
    const next = p < 0.25 ? 0 : p < 0.5 ? 1 : p < 0.75 ? 2 : 3;
    setActIndex((prev) => (prev === next ? prev : next));
  });

  const telemetryActive = actIndex === 3;
  const { reading, angleRef } = useTelemetry(telemetryActive);

  if (prefersReducedMotion || !modelUrl) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-24 text-center">
        <p className="text-xs uppercase tracking-[0.4em] text-white/50">Behind the Build</p>
        <p className="mt-4 text-white/70">
          Four acts of building R1: blueprint, brain, crisis, and the arena. Full motion story requires
          motion — view on a device without reduced-motion enabled to see it play out.
        </p>
      </section>
    );
  }

  return (
    <div ref={sectionRef} className="relative h-[420vh] sm:h-[460vh] md:h-[500vh]">
      <div className="sticky top-0 h-dvh overflow-hidden bg-black">
        <div className="absolute inset-0">
          {isNearView && (
            <BuildStoryStage
              url={modelUrl}
              progress={scrollYProgress}
              exploded={exploded}
              telemetryAngle={angleRef}
            />
          )}
        </div>

        {/* Act caption */}
        <motion.div style={{ opacity: captionOpacity }} className="pointer-events-none absolute left-6 top-24 z-10 max-w-xs sm:left-12">
          <p className="text-xs font-bold uppercase tracking-[0.4em] text-red">Act {ACTS[actIndex].roman}</p>
          <h3 className="mt-1 text-2xl font-bold text-white sm:text-3xl">{ACTS[actIndex].title}</h3>
          <p className="mt-2 text-sm text-white/60">{ACTS[actIndex].caption}</p>
        </motion.div>

        {/* Act II: click-to-explode control */}
        {actIndex === 1 && (
          <motion.button
            type="button"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            onClick={() => setExploded((v) => !v)}
            className="absolute bottom-24 left-1/2 z-10 flex -translate-x-1/2 items-center gap-2 rounded-full border border-white/20 bg-black/60 px-5 py-2.5 text-sm font-medium text-white backdrop-blur-sm transition hover:border-red hover:text-red"
          >
            <MousePointerClick size={16} />
            {exploded ? "Reassemble" : "Explode view"}
          </motion.button>
        )}

        {/* Act III: crisis banner */}
        {actIndex === 2 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 1, 0.6, 1] }}
            transition={{ duration: 1.4, repeat: Infinity, repeatType: "reverse" }}
            className="absolute bottom-24 left-1/2 z-10 -translate-x-1/2 rounded-md border border-red/50 bg-red/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.3em] text-red"
          >
            System fault detected
          </motion.div>
        )}

        {/* Act IV: telemetry HUD */}
        {actIndex === 3 && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="sharp-card absolute bottom-16 right-6 z-10 w-52 rounded-xl p-4 font-mono text-xs sm:right-12"
          >
            <p className="mb-2 text-[10px] uppercase tracking-[0.3em] text-white/50">Live Telemetry</p>
            <div className="space-y-1 text-white/80">
              <p>speed: {reading.speed.toFixed(2)} m/s</p>
              <p>current: {reading.current.toFixed(2)} A</p>
              <p>angle: {reading.angle.toFixed(1)}°</p>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}
