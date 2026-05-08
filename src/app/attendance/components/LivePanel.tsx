"use client";

import { UserStats, formatDuration } from "../logic";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

export interface DomainLeaderboardEntry {
  domain: string;
  total: number;
  members: number;
}

export function DomainLeaderboard({
  items = [],
  compact = false,
  className = "",
  loading = false,
}: {
  items?: DomainLeaderboardEntry[];
  compact?: boolean;
  className?: string;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div
        className={`overflow-hidden rounded-2xl border border-zinc-800/40 bg-gradient-to-br from-zinc-900/60 via-zinc-900/40 to-zinc-950/60 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] attendance-skeleton-surface ${className}`}
      >
        <div className="border-b border-zinc-800/40 bg-zinc-900/30 px-5 py-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="h-3 w-40 rounded-sm bg-zinc-800/90 attendance-skeleton-block" />
              <div className="mt-2 h-3 w-32 rounded-sm bg-zinc-800/80 attendance-skeleton-block" />
            </div>
            <div className="h-6 w-20 rounded-md bg-zinc-800/90 attendance-skeleton-block" />
          </div>
          <div className="mt-3 rounded-md border border-zinc-800/50 bg-zinc-900/40 px-3 py-2.5">
            <div className="h-3 w-14 rounded-sm bg-zinc-800/80 attendance-skeleton-block mb-2" />
            <div className="flex items-center justify-between gap-3">
              <div className="h-4 w-20 rounded-sm bg-zinc-800/90 attendance-skeleton-block" />
              <div className="h-4 w-16 rounded-sm bg-zinc-800/90 attendance-skeleton-block" />
            </div>
          </div>
        </div>

        <div className={`flex-1 overflow-y-auto p-4 no-scrollbar ${compact ? "space-y-2.5" : "space-y-3.5 sm:p-5"}`}>
          {Array.from({ length: compact ? 4 : 6 }).map((_, i) => (
            <div
              key={`domain-skeleton-${i}`}
              className="rounded-xl border border-zinc-800/40 bg-zinc-900/30 p-3.5"
            >
              <div className="mb-2.5 flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="mb-1.5 flex items-center gap-2">
                    <div className="h-6 w-6 rounded-md bg-zinc-800/90 attendance-skeleton-block" />
                    <div className="h-4 w-20 rounded-sm bg-zinc-800/90 attendance-skeleton-block" />
                  </div>
                  <div className="h-3 w-16 rounded-sm bg-zinc-800/80 attendance-skeleton-block" />
                </div>
                <div className="h-4 w-14 rounded-sm bg-zinc-800/90 attendance-skeleton-block" />
              </div>
              <div className="h-1.5 rounded-full bg-zinc-900">
                <div className="h-full w-3/5 rounded-full bg-zinc-800/80 attendance-skeleton-block" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const topTotal = items[0]?.total || 1;
  const topDomain = items[0];

  return (
    <div
      className={`relative flex flex-col overflow-hidden rounded-2xl border border-zinc-800/40 bg-gradient-to-br from-zinc-900/60 via-zinc-900/40 to-zinc-950/60 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] group hover:border-zinc-700/60 transition-all duration-300 ${className}`}
    >
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-red-500/50 via-red-500/10 to-transparent"></div>
      
      <div className="flex-shrink-0 border-b border-zinc-800/40 bg-zinc-900/30 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-[10px] font-bold tracking-[0.24em] text-zinc-400">DOMAIN LEADERBOARD</h4>
            <p className="mt-1 text-[10px] text-zinc-500 font-mono">
              Total logged time split by domain
            </p>
          </div>
          <div className="rounded-md border border-zinc-800/60 bg-zinc-900/60 px-2.5 py-1 text-[10px] font-bold tracking-widest text-zinc-400">
            {items.length} DOMAINS
          </div>
        </div>
        <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-red-500/20 bg-red-500/5 px-4 py-3 relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-r from-red-500/5 to-transparent pointer-events-none" />
          <div className="min-w-0 relative z-10">
            <p className="text-[9px] font-bold tracking-[0.24em] text-red-400/80">LEADER</p>
            <p className="truncate text-sm font-bold text-white mt-0.5">{topDomain?.domain || "N/A"}</p>
          </div>
          <p className="flex-shrink-0 font-mono text-base font-bold text-red-500 drop-shadow-[0_0_8px_rgba(239,68,68,0.5)] relative z-10">
            {topDomain ? formatDuration(topDomain.total) : "0h 0m"}
          </p>
        </div>
      </div>

      <div className={`flex-1 overflow-y-auto p-4 no-scrollbar ${compact ? "space-y-2.5" : "space-y-3.5 sm:p-5"}`}>
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed border-zinc-800 bg-zinc-900/30 px-4 py-8 text-center text-[11px] text-zinc-500 font-mono uppercase tracking-widest">
            No domain data
          </div>
        ) : (
          <div className={`grid gap-3 ${compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"}`}>
            {items.map((item, index) => {
              const share = Math.round((item.total / topTotal) * 100);
              const fillWidth = `${Math.max(5, share)}%`;
              const isTop = index === 0;
              const shineClass = isTop ? "after:content-[''] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-white/5 after:to-transparent after:skew-x-[-20deg] after:animate-[shimmer_5s_infinite]" : "";

              return (
                <motion.div
                  initial={{ opacity: 0, scale: 0.98 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  transition={{ delay: index * 0.05 }}
                  key={item.domain}
                  className={`rounded-xl border border-zinc-800/40 bg-zinc-900/40 p-3.5 transition-all duration-200 hover:border-zinc-700 hover:bg-zinc-800/60 hover:-translate-y-0.5 relative overflow-hidden ${shineClass}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className={`inline-flex h-6 min-w-6 items-center justify-center rounded-md border text-[10px] font-bold ${
                          index === 0 ? 'border-red-500/30 bg-red-500/10 text-red-400' : 'border-zinc-700 bg-zinc-800 text-zinc-400'
                        }`}>
                          {index + 1}
                        </span>
                        <h5 className="truncate text-sm font-bold tracking-wide text-zinc-100">{item.domain}</h5>
                      </div>
                      <p className="text-[10px] font-bold tracking-wider text-zinc-500 uppercase">
                        {item.members} members
                      </p>
                    </div>
                    <p className="flex-shrink-0 font-mono text-[13px] font-bold text-cyan-400/90">
                      {formatDuration(item.total)}
                    </p>
                  </div>

                  <div className="mt-3">
                    <div className="mb-1.5 flex items-center justify-between text-[9px] font-bold tracking-[0.18em] text-zinc-500">
                      <span>SHARE</span>
                      <span>{share}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-900 border border-zinc-800">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: fillWidth }}
                        transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                        className={`h-full rounded-full ${index === 0 ? 'bg-gradient-to-r from-red-500/50 to-red-500' : 'bg-gradient-to-r from-cyan-500/50 to-cyan-400'}`}
                      />
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function LivePanel({
  activeUsers,
  className = "",
  loading = false,
}: {
  activeUsers: UserStats[];
  className?: string;
  loading?: boolean;
}) {
  const [, setTick] = useState(0);
  const sortedActiveUsers = [...activeUsers].sort((a, b) => (b.lastTapMs - a.lastTapMs));
  const longestLiveMs = activeUsers.reduce((max, user) => Math.max(max, Date.now() - user.lastTapMs), 0);
  const averageLiveMs = activeUsers.length === 0
    ? 0
    : activeUsers.reduce((sum, user) => sum + Math.max(0, Date.now() - user.lastTapMs), 0) / activeUsers.length;

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  if (loading) {
    return (
      <div className={`attendance-skeleton-surface flex flex-col overflow-hidden rounded-2xl border border-zinc-800/40 bg-gradient-to-br from-zinc-900/60 via-zinc-900/40 to-zinc-950/60 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] ${className}`}>
        <div className="flex flex-shrink-0 items-center justify-between border-b border-zinc-800/40 bg-zinc-900/30 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-zinc-700 attendance-skeleton-block" />
            <div>
              <div className="h-3 w-20 rounded-sm bg-zinc-800/90 attendance-skeleton-block" />
              <div className="mt-2 h-3 w-28 rounded-sm bg-zinc-800/80 attendance-skeleton-block" />
            </div>
          </div>
          <div className="h-6 w-16 rounded-md bg-zinc-800/90 attendance-skeleton-block" />
        </div>

        <div className="grid grid-cols-2 gap-3 border-b border-zinc-800/40 bg-zinc-900/20 px-4 py-3">
          <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/40 px-3 py-2.5">
            <div className="h-3 w-14 rounded-sm bg-zinc-800/80 attendance-skeleton-block mb-2" />
            <div className="h-4 w-16 rounded-sm bg-zinc-800/90 attendance-skeleton-block" />
          </div>
          <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/40 px-3 py-2.5">
            <div className="h-3 w-14 rounded-sm bg-zinc-800/80 attendance-skeleton-block mb-2" />
            <div className="h-4 w-16 rounded-sm bg-zinc-800/90 attendance-skeleton-block" />
          </div>
        </div>

        <div className="flex-1 p-3 sm:p-4 space-y-2.5">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={`live-skeleton-${i}`}
              className="rounded-xl border border-zinc-800/40 bg-zinc-900/40 px-3.5 py-3"
            >
              <div className="mb-2 flex items-center gap-2">
                <div className="h-2.5 w-2.5 rounded-full bg-zinc-700 attendance-skeleton-block" />
                <div className="h-4 w-28 rounded-sm bg-zinc-800/90 attendance-skeleton-block" />
              </div>
              <div className="h-3 w-24 rounded-sm bg-zinc-800/80 attendance-skeleton-block" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={`relative flex flex-col overflow-hidden rounded-2xl border border-zinc-800/40 bg-gradient-to-br from-zinc-900/60 via-zinc-900/40 to-zinc-950/60 backdrop-blur-xl shadow-[0_8px_30px_rgba(0,0,0,0.12)] group hover:border-zinc-700/60 transition-all duration-300 ${className}`}>
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-red-500/50 via-red-500/10 to-transparent"></div>
      
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-zinc-800/40 bg-zinc-900/30 px-5 py-4">
        <div className="flex items-center gap-3">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
          </span>
          <div>
            <span className="text-[11px] font-bold tracking-[0.2em] text-white">LIVE IN LAB</span>
            <p className="mt-1 text-[10px] font-mono text-zinc-500">Members currently clocked in</p>
          </div>
        </div>
        <span className="rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-[10px] font-bold tracking-widest text-red-400 shadow-[0_0_10px_rgba(239,68,68,0.1)]">
          {activeUsers.length} ACTIVE
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3 border-b border-zinc-800/40 bg-zinc-900/20 px-4 py-3">
        <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/40 px-3 py-2.5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-red-500/40 to-transparent" />
          <p className="text-[9px] font-bold tracking-[0.2em] text-zinc-500">LONGEST DURATION</p>
          <p className="mt-1 font-mono text-sm font-bold text-cyan-400/90">{formatDuration(longestLiveMs)}</p>
        </div>
        <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/40 px-3 py-2.5 relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-cyan-500/40 to-transparent" />
          <p className="text-[9px] font-bold tracking-[0.2em] text-zinc-500">AVERAGE DURATION</p>
          <p className="mt-1 font-mono text-sm font-bold text-zinc-100">{formatDuration(averageLiveMs)}</p>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4 no-scrollbar">
        {activeUsers.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-4 h-8 w-8 rounded-full border border-zinc-800 bg-zinc-900/50 flex items-center justify-center">
                 <span className="h-2 w-2 rounded-full bg-zinc-700" />
              </div>
              <p className="text-[10px] font-mono font-bold tracking-widest text-zinc-600 uppercase">NO ACTIVE USERS</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2.5">
            <AnimatePresence>
              {sortedActiveUsers.map((user) => {
                const liveDur = Math.max(0, Date.now() - user.lastTapMs);
                return (
                  <motion.div
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    key={user.UID}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-zinc-800/50 bg-zinc-900/40 px-4 py-3 transition-all hover:border-zinc-700/80 hover:bg-zinc-800/60"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2.5">
                        <span className="relative flex h-2 w-2">
                          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-40"></span>
                          <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]"></span>
                        </span>
                        <p className="truncate text-sm font-bold text-zinc-100">{user.Name}</p>
                      </div>
                      <p className="mt-1.5 text-[10px] font-mono text-zinc-500 flex items-center gap-1.5">
                        <span className="text-zinc-600">IN @</span> {new Date(user.lastTapMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                    </div>
                    <p className="flex-shrink-0 rounded-md border border-red-500/20 bg-red-500/10 px-2.5 py-1.5 font-mono text-[13px] font-bold text-red-400/90 shadow-[0_0_10px_rgba(239,68,68,0.05)]">
                      {formatDuration(liveDur)}
                    </p>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </div>
  );
}

