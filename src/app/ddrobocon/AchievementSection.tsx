"use client";

import { useRef } from "react";
import { motion, useInView, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { Trophy } from "lucide-react";

const RED = "#C20000";
const ORANGE = "#FF7A00";

// Hard black outline via 8-direction text-shadow — more reliable across renderers
// than -webkit-text-stroke, which can invert fill/stroke at large sizes in some engines.
const numberOutline = (offsetPx: number) => {
  const s = offsetPx;
  return [
    `-${s}px -${s}px 0 #000`,
    `${s}px -${s}px 0 #000`,
    `-${s}px ${s}px 0 #000`,
    `${s}px ${s}px 0 #000`,
    `-${s}px 0 0 #000`,
    `${s}px 0 0 #000`,
    `0 -${s}px 0 #000`,
    `0 ${s}px 0 #000`,
  ].join(", ");
};

export default function AchievementSection({
  rank,
  label,
  year,
  theme,
}: {
  rank: number;
  label: string;
  year: string;
  theme: string;
}) {
  const prefersReducedMotion = useReducedMotion();

  if (prefersReducedMotion) {
    return (
      <section className="mx-auto max-w-3xl px-4 py-24 text-center">
        <div className="mx-auto max-w-xl -rotate-1 border-4 border-white bg-red px-6 py-6">
          <p className="text-lg font-black uppercase leading-tight text-white">
            Best rank of SRM Team Robocon at DD Robocon
          </p>
        </div>
        <p className="mt-10 text-sm uppercase tracking-[0.3em] text-white/60">{label}</p>
        <p className="mt-2 text-7xl font-black text-white" style={{ textShadow: numberOutline(3) }}>
          {rank}
        </p>
        <p className="mt-2 text-sm text-white/60">
          DD Robocon {year} · {theme}
        </p>
      </section>
    );
  }

  return <AnimatedAchievement rank={rank} label={label} year={year} theme={theme} />;
}

function AnimatedAchievement({
  rank,
  label,
  year,
  theme,
}: {
  rank: number;
  label: string;
  year: string;
  theme: string;
}) {
  const sectionRef = useRef<HTMLDivElement>(null);
  const beat2Ref = useRef<HTMLDivElement>(null);

  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start start", "end start"] });

  const speedLinesOpacity = useTransform(scrollYProgress, [0.06, 0.5], [0.1, 0.5]);

  // Beat 1: the claim, comic caption-box style.
  const beat1Opacity = useTransform(scrollYProgress, [0.06, 0.14, 0.24, 0.32], [0, 1, 1, 0]);
  const beat1Y = useTransform(scrollYProgress, [0.06, 0.14, 0.24, 0.32], [40, 0, 0, -40]);
  const beat1Scale = useTransform(scrollYProgress, [0.06, 0.14, 0.32], [0.9, 1, 1.06]);

  // Beat 2: the impact reveal.
  const beat2Opacity = useTransform(scrollYProgress, [0.36, 0.48], [0, 1]);
  const beat2Scale = useTransform(scrollYProgress, [0.36, 0.5], [0.85, 1]);

  const beat2InView = useInView(beat2Ref, { amount: 0.5 });

  return (
    <div ref={sectionRef} className="relative h-[240vh] sm:h-[260vh] md:h-[280vh]">
      <div className="sticky top-0 h-dvh overflow-hidden bg-black">
        {/* Radiating speed lines, intensify through the scroll */}
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-[-20%]"
          style={{
            opacity: speedLinesOpacity,
            backgroundImage:
              "repeating-conic-gradient(from 0deg, rgba(255,255,255,0.07) 0deg 3deg, transparent 3deg 14deg)",
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 50, repeat: Infinity, ease: "linear" }}
        />

        {/* Beat 1: claim, comic caption box */}
        <motion.div
          style={{ opacity: beat1Opacity, y: beat1Y, scale: beat1Scale }}
          className="absolute inset-0 flex items-center justify-center px-4"
        >
          <div
            className="max-w-3xl -rotate-2 border-4 border-white bg-red px-8 py-8 sm:px-14 sm:py-10"
            style={{ boxShadow: "12px 12px 0 rgba(0,0,0,0.9)" }}
          >
            <p className="text-center text-[8vw] font-black uppercase leading-[1.05] text-white sm:text-[4.4vw]">
              Best rank of SRM Team Robocon
              <br />
              at DD Robocon
            </p>
          </div>
        </motion.div>

        {/* Beat 2: impact reveal */}
        <motion.div
          ref={beat2Ref}
          style={{ opacity: beat2Opacity, scale: beat2Scale }}
          className="absolute inset-0 flex flex-col items-center justify-center overflow-hidden px-4"
        >
          {/* Starburst behind the number */}
          <div
            aria-hidden
            className="pointer-events-none absolute left-1/2 top-1/2 h-[95vmin] w-[95vmin] -translate-x-1/2 -translate-y-1/2"
            style={{
              backgroundImage: `repeating-conic-gradient(${RED} 0deg 8deg, ${ORANGE} 8deg 16deg, transparent 16deg 24deg, transparent 24deg 32deg)`,
              WebkitMaskImage: "radial-gradient(circle, black 0%, black 32%, transparent 65%)",
              maskImage: "radial-gradient(circle, black 0%, black 32%, transparent 65%)",
              opacity: 0.5,
            }}
          />

          {/* Impact flash */}
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-white"
            animate={{ opacity: beat2InView ? [0, 0.75, 0] : 0 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
          />

          <div className="relative z-10 flex flex-col items-center gap-2 text-center">
            <div
              className="inline-flex items-center gap-2 border-2 border-white bg-black px-4 py-1.5 text-xs font-bold uppercase tracking-[0.3em] text-white"
              style={{ boxShadow: `4px 4px 0 ${RED}` }}
            >
              <Trophy size={13} className="text-red" />
              {label}
            </div>

            <motion.span
              initial={false}
              animate={
                beat2InView ? { scale: 1, rotate: 0, opacity: 1 } : { scale: 2.6, rotate: -10, opacity: 0 }
              }
              transition={{ type: "spring", stiffness: 260, damping: 15 }}
              className="text-[32vmin] font-black leading-none text-white sm:text-[22vmin]"
              style={{
                textShadow: `${numberOutline(6)}, 12px 12px 0 ${RED}, 0 0 70px rgba(255,122,0,0.55)`,
              }}
            >
              {rank}
            </motion.span>

            <p className="mt-1 text-xs uppercase tracking-[0.4em] text-white/60">
              DD Robocon {year} · {theme}
            </p>
            <p className="max-w-xs text-sm text-white/70">
              SRM Team Robocon finishes in the top {rank} of the nation.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
