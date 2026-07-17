"use client";

import { useEffect } from "react";
import { motion, useMotionValue, useReducedMotion, useSpring, useTransform } from "framer-motion";

const RED = "#C20000";
const BLUE = "#2563EB";

/**
 * Two large ambient glows anchored near opposite corners that drift toward the cursor.
 * Fixed + pointer-events-none + low z-index so it sits behind page content; only shows
 * through sections that don't paint their own opaque background (Hero/Achievement do,
 * by design, so the glow reads as ambient embient lighting in the plainer sections).
 */
export default function CursorLights() {
  const prefersReducedMotion = useReducedMotion();
  const mx = useMotionValue(0.5);
  const my = useMotionValue(0.5);
  const sx = useSpring(mx, { stiffness: 40, damping: 20 });
  const sy = useSpring(my, { stiffness: 40, damping: 20 });

  useEffect(() => {
    if (prefersReducedMotion) return;
    const handleMove = (e: MouseEvent) => {
      mx.set(e.clientX / window.innerWidth);
      my.set(e.clientY / window.innerHeight);
    };
    window.addEventListener("mousemove", handleMove);
    return () => window.removeEventListener("mousemove", handleMove);
  }, [prefersReducedMotion, mx, my]);

  // Red anchors near the top-left corner, blue near bottom-right. Each is pulled toward the
  // cursor by the SAME magnitude from its own home, so whichever corner the cursor is nearer
  // to, that light reads brightest/closest — instead of one light dominating everywhere.
  const redX = useTransform(sx, [0, 1], ["-5%", "55%"]);
  const redY = useTransform(sy, [0, 1], ["-5%", "55%"]);
  const blueX = useTransform(sx, [0, 1], ["45%", "105%"]);
  const blueY = useTransform(sy, [0, 1], ["45%", "105%"]);

  if (prefersReducedMotion) return null;

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 z-[9999] overflow-hidden mix-blend-screen">
      <motion.div
        className="absolute h-[45vmax] w-[45vmax] rounded-full opacity-50 blur-[110px]"
        style={{ backgroundColor: RED, left: redX, top: redY, translateX: "-50%", translateY: "-50%" }}
      />
      <motion.div
        className="absolute h-[45vmax] w-[45vmax] rounded-full opacity-40 blur-[110px]"
        style={{ backgroundColor: BLUE, left: blueX, top: blueY, translateX: "-50%", translateY: "-50%" }}
      />
    </div>
  );
}
