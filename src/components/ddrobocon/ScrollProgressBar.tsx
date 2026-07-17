"use client";

import { motion, useScroll } from "framer-motion";

export default function ScrollProgressBar() {
  const { scrollYProgress } = useScroll();

  return (
    <motion.div
      className="pointer-events-none fixed left-0 top-0 z-[300] h-1 w-full origin-left bg-red"
      style={{ scaleX: scrollYProgress }}
    />
  );
}
