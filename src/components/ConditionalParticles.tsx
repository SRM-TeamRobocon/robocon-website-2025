"use client";

import { usePathname } from "next/navigation";
import ParticlesCom from "@/components/Particles";

// Register/login are the pages recruits spend the longest time on, actively typing
// into forms — the full-viewport animated canvas there is pure overhead competing for
// the same frame budget as everything else. Skip it on just these two routes; every
// other page keeps the ambient background.
const PARTICLES_DISABLED_PATHS = ["/recruit/register", "/recruit/login"];

export default function ConditionalParticles() {
  const pathname = usePathname();
  if (PARTICLES_DISABLED_PATHS.includes(pathname)) return null;
  return <ParticlesCom />;
}
