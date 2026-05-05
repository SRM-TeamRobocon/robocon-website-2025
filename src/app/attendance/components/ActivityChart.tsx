"use client";

import { useMemo } from "react";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { TapLog } from "../logic";

export function ActivityChart({
  logs,
  loading = false,
}: {
  logs: TapLog[];
  loading?: boolean;
}) {
  const data = useMemo(() => {
    // 1. Group logs strictly by the Date strings they provide
    // First, find all unique dates
    const dateMap = new Map<string, number>();

    // 2. Iterate backwards or over all logs to map out total hours
    // Simplified approximation: just count number of check-ins per day for "activity pulse"
    // (since calculating exact overlapping ms per day from raw logs is complex)
    for (const log of logs) {
      if (log.action === "IN") {
        dateMap.set(log.Date, (dateMap.get(log.Date) || 0) + 1);
      } else if (!log.action) {
        // Fallback for older data with no strict action column: just count all logs
        dateMap.set(log.Date, (dateMap.get(log.Date) || 0) + 0.5);
      }
    }

    // Sort by actual timestamp to keep chronological
    const sortedDates = Array.from(dateMap.keys()).sort((a, b) => {
      const partsA = a.includes('/') ? a.split('/') : a.split('-');
      const partsB = b.includes('/') ? b.split('/') : b.split('-');
      // Very rough sort: assuming DD/MM/YYYY or YYYY-MM-DD
      const da = a.includes('/') ? new Date(`${partsA[2]}-${partsA[1]}-${partsA[0]}`) : new Date(a);
      const db = b.includes('/') ? new Date(`${partsB[2]}-${partsB[1]}-${partsB[0]}`) : new Date(b);
      return da.getTime() - db.getTime();
    });

    return sortedDates.slice(-14).map(date => ({
      date: date.substring(0, 5), // 'DD/MM' or 'YYYY-'
      activity: Math.round(dateMap.get(date)!),
    }));
  }, [logs]);

  if (loading) {
    return (
      <div className="h-48 sm:h-64 w-full mt-4 bg-black border border-neutral-800 p-4 attendance-skeleton-surface">
        <div className="h-3 w-48 rounded-sm bg-neutral-800/90 attendance-skeleton-block mb-5" />
        <div className="h-[80%] w-full rounded-sm border border-neutral-800 bg-neutral-950/60 p-3">
          <div className="h-full w-full flex items-end gap-2 sm:gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <div
                key={`chart-skeleton-bar-${i}`}
                style={{ height: `${30 + ((i * 13) % 50)}%` }}
                className="flex-1 rounded-sm bg-neutral-800/80 attendance-skeleton-block"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (data.length === 0) return null;

  return (
    <div className="h-48 sm:h-64 w-full mt-4 bg-black border border-neutral-800 p-4">
      <h3 className="text-[10px] text-neutral-500 font-bold mb-4 tracking-widest uppercase">
        Recent Activity Pulse (Check-ins)
      </h3>
      <div className="h-full w-full">
        <ResponsiveContainer width="100%" height="80%">
          <AreaChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="colorRed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#C20000" stopOpacity={0.4} />
                <stop offset="95%" stopColor="#C20000" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="date" stroke="#333" fontSize={10} tickMargin={10} />
            <Tooltip
              contentStyle={{ backgroundColor: "#000", border: "1px solid #C20000", borderRadius: 0 }}
              itemStyle={{ color: "#fff", fontWeight: "bold" }}
              labelStyle={{ color: "#888", fontSize: 10 }}
            />
            <Area
              type="monotone"
              dataKey="activity"
              stroke="#C20000"
              strokeWidth={3}
              fillOpacity={1}
              fill="url(#colorRed)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
