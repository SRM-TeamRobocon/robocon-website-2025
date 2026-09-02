interface TimelineEntry {
  years: string;
  highlight?: string;
}

const TIMELINE: TimelineEntry[] = [
  { years: "2013" },
  { years: "2014", highlight: "Best Economical Robot" },
  { years: "2015" },
  { years: "2016-17", highlight: "National Rank 13 of 110" },
  { years: "2018" },
  { years: "2023", highlight: "Back on the national stage" },
  { years: "2026", highlight: "AIR 5 - DD Robocon" },
];

export default function AchievementsHistory() {
  return (
    <section className="mx-auto mb-12 max-w-6xl px-4 md:px-8">
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 md:p-8">
        <h2 className="text-xl font-bold text-white md:text-2xl">Our ABU Robocon Journey</h2>
        <p className="mt-1 text-sm text-white/60">
          From our first national entry in 2013 to AIR 5 in 2026.
        </p>

        <div className="relative mt-8">
          <div className="absolute inset-x-0 top-[7px] hidden h-px bg-white/10 sm:block" aria-hidden />
          <ol className="relative flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
            {TIMELINE.map((entry) => (
              <li
                key={entry.years}
                className="flex items-start gap-3 sm:flex-col sm:items-center sm:gap-3 sm:text-center"
              >
                <span
                  className={`mt-1 h-3.5 w-3.5 shrink-0 rounded-full border-2 border-black sm:mt-0 ${
                    entry.highlight ? "bg-red" : "bg-white/20"
                  }`}
                  aria-hidden
                />
                <div>
                  <div className="font-semibold text-white">{entry.years}</div>
                  {entry.highlight && (
                    <div className="mt-1 text-xs text-red sm:max-w-[8.5rem]">{entry.highlight}</div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
