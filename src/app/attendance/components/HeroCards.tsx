"use client";

import { motion } from "framer-motion";
import { UserStats, formatDuration } from "../logic";
import { Zap, TrendingUp, Clock } from "lucide-react";

export function HeroCards({
  topUsers,
  loading = false,
}: {
  topUsers: UserStats[];
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
        {Array.from({ length: 3 }).map((_, i) => (
          <div
            key={`hero-skeleton-${i}`}
            className="group relative h-full"
          >
            {/* Glassmorphism skeleton */}
            <div className="absolute inset-0 bg-gradient-to-br from-red-500/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
            <div className="relative h-80 rounded-2xl bg-gradient-to-br from-zinc-900/40 via-zinc-900/20 to-transparent border border-zinc-800/40 backdrop-blur-md p-5 sm:p-6 md:p-7 flex flex-col overflow-hidden">
              {/* Top accent line */}
              <div className="absolute top-0 left-0 h-px w-full bg-gradient-to-r from-red-500/50 via-red-500/25 to-transparent" />
              
              {/* Glow effect */}
              <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-radial-gradient from-red-500/10 to-transparent rounded-full blur-2xl" />

              {/* Skeleton elements */}
              <div className="relative space-y-4">
                <div className="h-12 w-12 rounded-full bg-zinc-800/60 attendance-skeleton-block" />
                <div className="h-6 w-2/3 rounded bg-zinc-800/60 attendance-skeleton-block" />
                <div className="h-3 w-1/2 rounded bg-zinc-800/40 attendance-skeleton-block" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!topUsers || topUsers.length === 0) return null;

  const ranks = [
    {
      tier: "PLATINUM",
      badgeColor: "bg-red text-white shadow-lg shadow-red/40",
      borderGlow: "border-red/60",
      accentGlow: "shadow-[0_0_20px_rgba(239,68,68,0.3),inset_0_0_20px_rgba(239,68,68,0.1)]",
      accentWidth: "w-full",
      icon: Zap,
    },
    {
      tier: "GOLD",
      badgeColor: "bg-red/70 text-white shadow-lg shadow-red/20",
      borderGlow: "border-red/40",
      accentGlow: "shadow-[0_0_15px_rgba(239,68,68,0.2)]",
      accentWidth: "w-2/3",
      icon: TrendingUp,
    },
    {
      tier: "SILVER",
      badgeColor: "bg-red/50 text-white",
      borderGlow: "border-red/25",
      accentGlow: "shadow-[0_0_10px_rgba(239,68,68,0.1)]",
      accentWidth: "w-1/3",
      icon: Clock,
    },
  ];

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5 lg:gap-6">
      {topUsers.map((user, i) => {
        const r = ranks[i] || ranks[2];
        const IconComponent = r.icon;
        
        return (
          <motion.div
            key={user.UID}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1, duration: 0.4, ease: "easeOut" }}
            className="group relative h-full"
            whileHover={{ y: -4 }}
          >
            {/* Background glow effect */}
            <motion.div
              className={`absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 ${r.accentGlow}`}
              initial={false}
              animate={{
                background: "linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(239,68,68,0.04) 50%, transparent 100%)",
              }}
            />

            {/* Glassmorphic card container */}
            <div className={`relative h-full rounded-2xl bg-gradient-to-br from-zinc-900/60 via-zinc-900/40 to-zinc-950/60 border ${r.borderGlow} backdrop-blur-xl p-5 sm:p-6 md:p-7 flex flex-col overflow-hidden transition-all duration-300 group-hover:border-red/50`}>
              
              {/* Top accent line - gradient */}
              <motion.div
                className={`absolute top-0 left-0 h-px bg-gradient-to-r from-red-500/80 via-red-500/40 to-transparent ${r.accentWidth}`}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ delay: i * 0.15 + 0.2, duration: 0.5 }}
              />

              {/* Corner accent glow */}
              <div className="absolute -top-1/2 -right-1/2 w-full h-full bg-radial-gradient from-red-500/5 to-transparent rounded-full blur-3xl pointer-events-none" />

              {/* Content wrapper */}
              <div className="relative space-y-4 sm:space-y-5 flex-1 flex flex-col">
                
                {/* Header: Rank badge + Live status */}
                <div className="flex items-center justify-between gap-3">
                  <motion.div
                    className={`flex items-center justify-center gap-2 px-3 sm:px-4 py-2 rounded-full font-bold text-xs sm:text-sm tracking-wider ${r.badgeColor} relative`}
                    whileHover={{ scale: 1.05 }}
                    transition={{ duration: 0.2 }}
                  >
                    <span className="text-lg sm:text-xl">#{i + 1}</span>
                    <span className="text-[10px] sm:text-xs font-medium text-white/70 ml-1">{r.tier}</span>
                  </motion.div>
                  
                  {user.status === "IN" && (
                    <motion.div
                      className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-full bg-gradient-to-r from-red-500/20 to-red-500/10 border border-red-500/40 text-red-400 text-[9px] sm:text-[10px] font-bold tracking-widest"
                      animate={{ boxShadow: ["0 0 10px rgba(239,68,68,0.4)", "0 0 20px rgba(239,68,68,0.2)"] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <motion.div
                        className="w-1.5 h-1.5 bg-red-500 rounded-full"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      />
                      LIVE
                    </motion.div>
                  )}
                </div>

                {/* User info section */}
                <div className="space-y-1 sm:space-y-1.5">
                  <motion.h3
                    className="text-lg sm:text-xl md:text-2xl font-bold text-white tracking-tight line-clamp-1"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.15 + 0.1 }}
                  >
                    {user.Name}
                  </motion.h3>
                  <motion.p
                    className="text-[9px] sm:text-[10px] text-zinc-400 font-mono tracking-widest uppercase"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: i * 0.15 + 0.15 }}
                  >
                    ID: {user.UID}
                  </motion.p>
                </div>

                {/* Spacer */}
                <div className="flex-1" />

                {/* Telemetry metrics section */}
                <motion.div
                  className="space-y-3 sm:space-y-4 pt-4 sm:pt-5 border-t border-zinc-800/50"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.15 + 0.2 }}
                >
                  {/* Primary metric */}
                  <div className="flex items-end justify-between">
                    <div className="space-y-0.5">
                      <p className="text-[8px] sm:text-[9px] text-zinc-500 font-mono tracking-widest uppercase">
                        TOTAL TIME
                      </p>
                      <motion.div
                        className="font-mono text-xl sm:text-2xl md:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-400 to-red-500"
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ delay: i * 0.15 + 0.3, duration: 0.4 }}
                      >
                        {formatDuration(user.overallTotalTimeMs)}
                      </motion.div>
                    </div>
                    <motion.div
                      whileHover={{ rotate: 12, scale: 1.1 }}
                      transition={{ duration: 0.2 }}
                    >
                      <IconComponent className="w-5 h-5 sm:w-6 sm:h-6 text-red-500/60" strokeWidth={1.5} />
                    </motion.div>
                  </div>

                  {/* Performance indicator bar */}
                  <div className="space-y-1.5">
                    <p className="text-[8px] text-zinc-600 font-mono tracking-widest uppercase">
                      PERFORMANCE
                    </p>
                    <div className="h-1.5 bg-zinc-800/40 rounded-full overflow-hidden backdrop-blur-sm border border-zinc-700/30">
                      <motion.div
                        className={`h-full bg-gradient-to-r from-red-500 to-red-400 rounded-full`}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, ((i + 1) / topUsers.length) * 150)}%` }}
                        transition={{ delay: i * 0.15 + 0.4, duration: 0.6, ease: "easeOut" }}
                      />
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* Hover border glow animation */}
              <motion.div
                className="absolute inset-0 rounded-2xl border border-red-500/0 pointer-events-none"
                whileHover={{
                  borderColor: "rgba(239, 68, 68, 0.3)",
                }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
