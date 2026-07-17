export default function Marquee({ text }: { text: string }) {
  const row = Array.from({ length: 6 }, (_, i) => (
    <span key={i} className="mx-6 inline-flex items-center gap-6">
      <span>{text}</span>
      <span className="text-red">◆</span>
    </span>
  ));

  return (
    <div className="overflow-hidden border-y border-white/10 bg-white/[0.02] py-4" aria-hidden>
      <div className="animate-marquee inline-flex whitespace-nowrap text-sm font-medium uppercase tracking-[0.3em] text-white/40">
        {row}
        {row}
      </div>
    </div>
  );
}
