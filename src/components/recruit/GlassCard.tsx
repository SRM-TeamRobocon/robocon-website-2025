"use client";

import GlassSurface from "@/components/GlassSurface";

// Standard dark-glass card recipe used across the recruitment pages: a genuinely
// see-through panel — no white tint — that reads as pure "material" (blur +
// refraction + a hairline edge) floating over the dark RecruitBackdrop. Content
// inside should use light text (see recruit page styles) since there's no light
// surface behind it anymore.
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
    <GlassSurface
      width="100%"
      height="auto"
      borderRadius={borderRadius}
      brightness={96}
      opacity={0.6}
      blur={18}
      displace={0.5}
      backgroundOpacity={0}
      saturation={1.6}
      distortionScale={-120}
      redOffset={0}
      greenOffset={6}
      blueOffset={14}
      className={className}
    >
      <div className={`w-full ${contentClassName}`}>{children}</div>
    </GlassSurface>
  );
}
