export function StatsPanel({ totalActive, totalHoursMs, totalUsers }: { totalActive: number; totalHoursMs: number; totalUsers: number }) {
  const hours = Math.floor(Math.max(0, totalHoursMs) / (1000 * 60 * 60));
  const mins = Math.floor((Math.max(0, totalHoursMs) % (1000 * 60 * 60)) / (1000 * 60));

  return (
    <div className="flex flex-wrap gap-6 bg-gradient-to-br from-zinc-900/60 via-zinc-900/40 to-zinc-950/60 backdrop-blur-xl border border-zinc-800/40 p-4 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
      <Stat label="IN LAB NOW" value={totalActive.toString()} accent="red" />
      <Stat label="TOTAL HOURS" value={`${hours}h ${mins}m`} accent="zinc" />
      <Stat label="MEMBERS" value={totalUsers.toString()} accent="zinc" />
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  const borderColor = accent === "red" ? "border-red-500/50" : "border-zinc-700";
  const valueColor = accent === "red" ? "text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-500" : "text-zinc-100";

  return (
    <div className={`border-l-2 ${borderColor} pl-4 py-1`}>
      <p className="text-[9px] text-zinc-500 tracking-[0.2em] font-bold mb-1 uppercase">{label}</p>
      <p className={`text-xl font-bold ${valueColor} tracking-tight font-mono`}>{value}</p>
    </div>
  );
}
