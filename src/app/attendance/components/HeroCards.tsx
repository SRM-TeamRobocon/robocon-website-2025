"use client";

import { motion } from "framer-motion";
import { UserStats, formatDuration } from "../logic";

export function HeroCards({
  topUsers,
  loading = false,
}: {
  topUsers: UserStats[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={`hero-skeleton-${i}`}
            className="attendance-skeleton-surface bg-black border border-neutral-800 p-5 sm:p-6 relative overflow-hidden"
          >
            <div className="absolute top-0 left-0 h-[3px] w-full bg-neutral-700/70 attendance-skeleton-block" />

            <div className="mb-4 sm:mb-5 flex items-center justify-between">
              <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-sm bg-neutral-800/90 attendance-skeleton-block" />
              <div className="h-5 w-12 rounded-sm bg-neutral-800/90 attendance-skeleton-block" />
            </div>

            <div className="mb-2 h-6 w-2/3 rounded-sm bg-neutral-800/90 attendance-skeleton-block" />
            <div className="mb-5 h-3 w-1/2 rounded-sm bg-neutral-800/80 attendance-skeleton-block" />

            <div className="pt-3 sm:pt-4 border-t border-neutral-800">
              <div className="mb-2 h-3 w-24 rounded-sm bg-neutral-800/80 attendance-skeleton-block" />
              <div className="h-8 w-28 rounded-sm bg-neutral-800/90 attendance-skeleton-block" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!topUsers || topUsers.length === 0) return null;

  const ranks = [
    { border: "border-red", glow: "shadow-[0_0_25px_rgba(194,0,0,0.15)]", badge: "bg-red text-white" },
    { border: "border-red/50", glow: "", badge: "bg-red/60 text-white" },
    { border: "border-red/30", glow: "", badge: "bg-red/30 text-white" },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5">
      {topUsers.map((user, i) => {
        const r = ranks[i] || ranks[2];
        return (
          <motion.div
            key={user.UID}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`bg-black border ${r.border} ${r.glow} p-5 sm:p-6 group hover:border-red transition-all duration-300 relative overflow-hidden`}
          >
            {/* Top accent */}
            <div className={`absolute top-0 left-0 h-[3px] bg-red ${i === 0 ? "w-full" : i === 1 ? "w-2/3" : "w-1/3"}`} />

            <div className="flex items-center justify-between mb-4 sm:mb-5">
              <span className={`w-8 h-8 sm:w-9 sm:h-9 flex items-center justify-center text-xs sm:text-sm font-bold ${r.badge}`}>
                #{i + 1}
              </span>
              {user.status === "IN" && (
                <span className="flex items-center gap-1.5 text-[8px] sm:text-[9px] font-bold tracking-widest text-red bg-red/10 border border-red/30 px-2 py-0.5 sm:px-2.5 sm:py-1">
                  <span className="w-1.5 h-1.5 bg-red animate-pulse" />
                  LIVE
                </span>
              )}
            </div>

            <h3 className="text-lg sm:text-xl font-bold text-white mb-0.5 truncate">{user.Name}</h3>
            <p className="text-[9px] sm:text-[10px] text-neutral-600 font-mono tracking-wider mb-4 sm:mb-5">{user.UID}</p>

            <div className="pt-3 sm:pt-4 border-t border-neutral-800">
              <p className="text-[8px] sm:text-[9px] text-neutral-500 tracking-widest mb-1">TOTAL TIME</p>
              <p className="text-xl sm:text-2xl font-bold text-white">{formatDuration(user.overallTotalTimeMs)}</p>
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
