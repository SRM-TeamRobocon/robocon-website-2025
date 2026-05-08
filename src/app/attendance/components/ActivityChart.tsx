"use client";

import { useMemo } from "react";
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from "recharts";
import { motion } from "framer-motion";
import { TapLog } from "../logic";

export function ActivityChart({
  logs,
  loading = false,
}: {
  logs: TapLog[];
  loading?: boolean;
}) {
  const data = useMemo(() => {
    const dateMap = new Map<string, number>();

    for (const log of logs) {
      if (log.action === "IN") {
        dateMap.set(log.Date, (dateMap.get(log.Date) || 0) + 1);
      } else if (!log.action) {
        dateMap.set(log.Date, (dateMap.get(log.Date) || 0) + 0.5);
      }
    }

    const sortedDates = Array.from(dateMap.keys()).sort((a, b) => {
      const partsA = a.includes('/') ? a.split('/') : a.split('-');
      const partsB = b.includes('/') ? b.split('/') : b.split('-');
      const da = a.includes('/') ? new Date(`${partsA[2]}-${partsA[1]}-${partsA[0]}`) : new Date(a);
      const db = b.includes('/') ? new Date(`${partsB[2]}-${partsB[1]}-${partsB[0]}`) : new Date(b);
      return da.getTime() - db.getTime();
    });

    return sortedDates.slice(-14).map(date => ({
      date: date.substring(0, 5),
      activity: Math.round(dateMap.get(date)!),
    }));
  }, [logs]);

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="h-64 sm:h-72 w-full bg-gradient-to-br from-zinc-900/60 via-zinc-900/40 to-zinc-950/60 border border-zinc-800/40 backdrop-blur-xl p-6 rounded-2xl overflow-hidden"
      >
        {/* Top accent line */}
        <div className="absolute top-0 left-0 h-px w-full bg-gradient-to-r from-red-500/50 via-red-500/25 to-transparent" />
        
        <div className="h-4 w-48 rounded-lg bg-zinc-800/60 attendance-skeleton-block mb-6" />
        <div className="h-[80%] w-full rounded-lg border border-zinc-700/30 bg-zinc-950/40 p-4">
          <div className="h-full w-full flex items-end gap-2 sm:gap-3">
            {Array.from({ length: 12 }).map((_, i) => (
              <motion.div
                key={`chart-skeleton-bar-${i}`}
                initial={{ height: 0 }}
                animate={{ height: `${30 + ((i * 13) % 50)}%` }}
                transition={{ delay: i * 0.05, duration: 0.3 }}
                style={{ height: `${30 + ((i * 13) % 50)}%` }}
                className="flex-1 rounded-sm bg-gradient-to-t from-red-500/40 to-red-500/20 attendance-skeleton-block"
              />
            ))}
          </div>
        </div>
      </motion.div>
    );
  }

  if (data.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="h-64 sm:h-72 w-full bg-gradient-to-br from-zinc-900/60 via-zinc-900/40 to-zinc-950/60 border border-zinc-800/40 backdrop-blur-xl p-6 rounded-2xl overflow-hidden group hover:border-zinc-700/60 transition-all duration-300 relative"
    >
      {/* Background glow on hover */}
      <motion.div
        className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300"
        initial={false}
      />

      {/* Top accent line */}
      <motion.div
        className="absolute top-0 left-0 h-px bg-gradient-to-r from-red-500/50 via-red-500/25 to-transparent w-full"
        initial={{ scaleX: 0 }}
        whileInView={{ scaleX: 1 }}
        transition={{ delay: 0.2, duration: 0.5 }}
      />

      <div className="relative z-10">
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="text-xs text-zinc-400 font-bold mb-1 tracking-widest uppercase">Activity Telemetry</h3>
            <p className="text-[9px] text-zinc-500 font-medium">14-day check-in frequency</p>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-500">{data.length}</div>
            <p className="text-[9px] text-zinc-500 mt-0.5">days tracked</p>
          </div>
        </div>
        
        <div className="h-full w-full">
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={data} margin={{ top: 5, right: 5, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="colorRed" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#ef4444" stopOpacity={0.5} />
                  <stop offset="95%" stopColor="#ef4444" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                stroke="#52525b"
                fontSize={11}
                tickMargin={8}
                tick={{ fill: '#a1a1aa' }}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "rgba(24, 24, 27, 0.95)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  borderRadius: "8px",
                  backdropFilter: "blur(12px)",
                }}
                itemStyle={{ color: "#fca5a5", fontWeight: "bold", fontSize: 12 }}
                labelStyle={{ color: "#a1a1aa", fontSize: 11 }}
              />
              <Area
                type="monotone"
                dataKey="activity"
                stroke="#ef4444"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#colorRed)"
                isAnimationActive={true}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
}
