"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import {
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
} from "framer-motion";
import { ChevronDown, Trophy } from "lucide-react";
import BotDetailModal from "@/components/bots/BotDetailModal";
import type { ContentCardItem } from "@/components/ContentGrid";
import { GOLD, RED_EXTRUDE } from "@/components/ddrobocon/textExtrude";

const HeroStage = dynamic(() => import("./HeroStage"), {
  ssr: false,
  loading: () => null,
});

function StaggerText({ text, className, baseDelay = 0 }: { text: string; className?: string; baseDelay?: number }) {
  return (
    <span className={className} aria-label={text}>
      {text.split("").map((ch, i) => (
        <motion.span
          key={`${ch}-${i}`}
          aria-hidden
          className="inline-block"
          initial={{ opacity: 0, y: 60, rotateX: 90 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ delay: baseDelay + i * 0.04, duration: 0.55, ease: [0.215, 0.61, 0.355, 1] }}
        >
          {ch === " " ? " " : ch}
        </motion.span>
      ))}
    </span>
  );
}

export default function Hero({
  year,
  theme,
  bots,
  rank,
}: {
  year: string;
  theme: string;
  bots: ContentCardItem[];
  rank: number;
}) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = useReducedMotion();
  const [activeBot, setActiveBot] = useState<ContentCardItem | null>(null);

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });

  // Title: full-screen billboard -> docks to top as the page heading.
  const titleY = useTransform(scrollYProgress, [0.02, 0.45], ["30vh", "0vh"]);
  const titleScale = useTransform(scrollYProgress, [0.02, 0.45], [1, 0.42]);
  const titleTilt = useTransform(scrollYProgress, [0.02, 0.45], [12, 0]);
  // White-red opening backdrop fades to the site's black as the title docks.
  const whiteOpacity = useTransform(scrollYProgress, [0.16, 0.46], [1, 0]);
  // Bots rise in underneath once the title is on its way up.
  const botsOpacity = useTransform(scrollYProgress, [0.3, 0.52], [0, 1]);
  const botsY = useTransform(scrollYProgress, [0.3, 0.52], ["12vh", "0vh"]);
  const labelsOpacity = useTransform(scrollYProgress, [0.48, 0.6], [0, 1]);
  // Phase-A-only extras.
  const extrasOpacity = useTransform(scrollYProgress, [0.12, 0.35], [1, 0]);
  const hintOpacity = useTransform(scrollYProgress, [0, 0.08], [1, 0]);

  // Cursor parallax (-1..1, spring-damped) + drag-to-spin accumulator (radians).
  const cursorX = useMotionValue(0);
  const cursorY = useMotionValue(0);
  const springX = useSpring(cursorX, { stiffness: 60, damping: 15 });
  const springY = useSpring(cursorY, { stiffness: 60, damping: 15 });
  const parallaxTitleX = useTransform(springX, (v) => v * 10);
  const parallaxSceneX = useTransform(springX, (v) => v * -18);
  const dragTurn = useMotionValue(0);
  const dragState = useRef({ dragging: false, lastX: 0, moved: 0 });

  const isNearView = useInView(sectionRef, { margin: "50% 0px 50% 0px" });

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (prefersReducedMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    cursorX.set(((e.clientX - rect.left) / rect.width) * 2 - 1);
    cursorY.set(((e.clientY - rect.top) / rect.height) * 2 - 1);
  };

  const modelUrl = bots[0]?.modelUrl;
  const still = prefersReducedMotion;

  return (
    <div ref={sectionRef} className="relative h-[260vh] sm:h-[280vh] md:h-[300vh]">
      <div onMouseMove={handleMouseMove} className="sticky top-0 h-dvh overflow-hidden bg-black">
        {/* Phase A backdrop: white with red energy. Fades out as the title docks. */}
        <motion.div aria-hidden style={{ opacity: still ? 0 : whiteOpacity }} className="absolute inset-0">
          <div className="absolute inset-0 bg-white" />
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 15% 110%, rgba(194,0,0,0.35) 0%, transparent 45%), radial-gradient(circle at 85% -10%, rgba(194,0,0,0.3) 0%, transparent 45%), radial-gradient(circle at 50% 50%, transparent 55%, rgba(194,0,0,0.12) 100%)",
            }}
          />
          {/* Keeps the white logo/progress bar readable while the backdrop is light. */}
          <div className="absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/40 to-transparent" />
        </motion.div>

        {/* Bots: hidden during the billboard phase, rise in as the title docks. */}
        <motion.div
          style={{
            opacity: still ? 1 : botsOpacity,
            y: still ? "0vh" : botsY,
            x: still ? 0 : parallaxSceneX,
          }}
          className="pointer-events-none absolute inset-x-0 bottom-0 top-[14vh]"
        >
          {isNearView && modelUrl ? (
            <HeroStage
              url={modelUrl}
              spin={still ? undefined : scrollYProgress}
              drag={dragTurn}
              lean={still ? undefined : springX}
            />
          ) : null}
        </motion.div>

        {/* Drag-to-spin layer: consumes horizontal drags, leaves vertical scroll native (touch-action pan-y). */}
        <div
          className="absolute inset-0 z-[5] cursor-grab active:cursor-grabbing"
          style={{ touchAction: "pan-y" }}
          onPointerDown={(e) => {
            dragState.current = { dragging: true, lastX: e.clientX, moved: 0 };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!dragState.current.dragging) return;
            const delta = e.clientX - dragState.current.lastX;
            dragState.current.lastX = e.clientX;
            dragState.current.moved += Math.abs(delta);
            dragTurn.set(dragTurn.get() + delta / 260);
          }}
          onPointerUp={(e) => {
            dragState.current.dragging = false;
            e.currentTarget.releasePointerCapture(e.pointerId);
          }}
          onPointerCancel={() => {
            dragState.current.dragging = false;
          }}
        />

        <motion.div
          style={{ opacity: still ? 1 : labelsOpacity }}
          className="pointer-events-none absolute inset-x-0 top-[30%] z-20 hidden justify-center gap-[38vw] md:flex"
        >
          {bots.slice(0, 2).map((bot) => (
            <button
              key={bot.key}
              type="button"
              onClick={() => setActiveBot(bot)}
              className="pointer-events-auto rounded-md border border-white/15 bg-black/50 px-3 py-1 text-xs font-bold tracking-[0.3em] text-white/80 backdrop-blur-sm transition hover:border-red hover:text-red"
            >
              {bot.name} ↗
            </button>
          ))}
        </motion.div>

        {/* Title block: giant 3D billboard that becomes the page heading. */}
        <div className="pointer-events-none absolute inset-x-0 top-[9vh] z-10" style={{ perspective: 900 }}>
          <motion.div
            style={{
              y: still ? "0vh" : titleY,
              scale: still ? 0.42 : titleScale,
              rotateX: still ? 0 : titleTilt,
              x: still ? 0 : parallaxTitleX,
              transformOrigin: "top center",
            }}
            className="text-center"
          >
            <h1
              className="whitespace-nowrap px-2 text-[8.5vw] font-bold leading-none text-red"
              style={{ textShadow: RED_EXTRUDE }}
            >
              <StaggerText text="DD ROBOCON" /> <StaggerText text={year} baseDelay={0.5} />
            </h1>

            <motion.div style={{ opacity: still ? 0 : extrasOpacity }}>
              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9, duration: 0.6, ease: "easeOut" }}
                className="mt-[3vh] text-[2vw] font-medium uppercase tracking-[0.6em] text-black/60 md:text-[1.4vw]"
              >
                {theme}
              </motion.p>
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: 1.15, duration: 0.5, ease: "easeOut" }}
                className="mt-[2.5vh] inline-flex items-center gap-2 rounded-full border px-5 py-2 text-[1.8vw] font-bold md:text-[1.1vw]"
                style={{ borderColor: `${GOLD}88`, backgroundColor: "rgba(0,0,0,0.75)", color: GOLD }}
              >
                <Trophy className="h-[1em] w-[1em]" />
                All India Rank {rank}
              </motion.div>
            </motion.div>
          </motion.div>
        </div>

        <motion.div
          style={{ opacity: still ? 1 : hintOpacity }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.6, duration: 0.8 }}
          className="pointer-events-none absolute bottom-8 left-1/2 z-10 -translate-x-1/2 text-center"
        >
          <p className="mb-1 text-[10px] uppercase tracking-[0.3em] text-black/50">Scroll</p>
          <ChevronDown size={20} className="mx-auto animate-bounce text-red" />
        </motion.div>
      </div>

      {activeBot && <BotDetailModal item={activeBot} onClose={() => setActiveBot(null)} />}
    </div>
  );
}
