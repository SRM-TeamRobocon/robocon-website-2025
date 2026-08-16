"use client";

import { usePathname } from "next/navigation";
import ParticlesCom from "@/components/Particles";

// These are the pages people spend the longest time on actively typing into forms —
// the full-viewport animated canvas is pure overhead competing for the same frame
// budget as everything else, and combined with the backdrop-blur glass card on top of
// it, iOS Safari in particular can drop/lag keystrokes badly enough that typing feels
// broken. Skip it on just these routes; every other page keeps the ambient background.
const PARTICLES_DISABLED_PATHS = [
  "/recruit/register",
  "/recruit/login",
  "/login",
  "/signup",
  "/forgot-password",
];

export default function ConditionalParticles() {
  const pathname = usePathname();
  if (PARTICLES_DISABLED_PATHS.includes(pathname)) return null;
  return <ParticlesCom />;
}
