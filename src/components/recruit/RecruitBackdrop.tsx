// Backdrop behind every recruitment page's glass cards.
//
// Intentionally translucent rather than solid: the global <ParticlesCom /> canvas in
// the root layout sits at z-0, below the `relative z-10` content wrapper, so an opaque
// backdrop here would hide it. This paints only a vignette — clear in the middle where
// the particles and their links read best, darker toward the edges so the glass cards
// and their light text keep contrast.
//
// Also deliberately NOT the global .robocon-theme-bg class: that one paints via
// `::before`/`::after` at `position: fixed; inset: 0`, which escapes its own box and
// covers the whole viewport. On a page root (see /attendance) that's the intent, but
// anywhere mid-page it blankets everything painted before it — that is exactly what
// blanked the homepage hero when RecruitmentSection used it.
export default function RecruitBackdrop() {
  return (
    <div
      className="pointer-events-none fixed inset-0 -z-10 bg-[radial-gradient(circle_at_center,rgba(0,0,0,0.2)_0%,rgba(0,0,0,0.82)_100%)]"
      aria-hidden="true"
    />
  );
}
