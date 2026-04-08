export function StatsPanel({ totalActive, totalHoursMs, totalUsers }: { totalActive: number; totalHoursMs: number; totalUsers: number }) {
  const hours = Math.floor(Math.max(0, totalHoursMs) / (1000 * 60 * 60));
  const mins = Math.floor((Math.max(0, totalHoursMs) % (1000 * 60 * 60)) / (1000 * 60));

  return (
    <div className="flex flex-wrap gap-4">
      <Stat label="IN LAB NOW" value={totalActive.toString()} accent="red" />
      <Stat label="TOTAL HOURS" value={`${hours}h ${mins}m`} accent="gray" />
      <Stat label="MEMBERS" value={totalUsers.toString()} accent="gray" />
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent: string }) {
  const borderColor = accent === "red" ? "border-red-600" : "border-gray-700";
  const valueColor = accent === "red" ? "text-red-500" : "text-white";

  return (
    <div className={`border-l-2 ${borderColor} pl-4 py-1`}>
      <p className="text-[9px] text-gray-500 tracking-[0.2em] font-bold mb-0.5">{label}</p>
      <p className={`text-xl font-bold ${valueColor} tracking-tight`}>{value}</p>
    </div>
  );
}
