"use client";

// Standard dark-card recipe used across the recruitment pages: a solid dark panel
// with a hairline border and a soft drop shadow — no backdrop-filter, no SVG filter
// chain. The old version (GlassSurface) rebuilt a 3-channel SVG displacement filter
// per instance and re-encoded it on every resize, then asked the GPU to resample a
// live, always-animating background (ParticlesCom) through it every frame. That was
// the single heaviest thing on these pages, multiplied by however many cards were on
// screen at once (register/dashboard stack several). This trades the "real glass"
// refraction look for a flat, cheap panel — same dark-material read, none of the cost.
export default function GlassCard({
  children,
  className = "",
  contentClassName = "",
  borderRadius = 28,
}: {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  borderRadius?: number;
}) {
  return (
    <div
      className={`w-full bg-[rgba(12,12,16,0.72)] border border-white/[0.14] shadow-[0_8px_32px_rgba(0,0,0,0.35),0_2px_16px_rgba(0,0,0,0.2),inset_0_1px_0_0_rgba(255,255,255,0.08)] ${className}`}
      style={{ borderRadius: `${borderRadius}px` }}
    >
      <div className={`w-full ${contentClassName}`}>{children}</div>
    </div>
  );
}
