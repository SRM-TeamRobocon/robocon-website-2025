"use client";

import { UserStats, formatDuration } from "../logic";
import { useEffect, useState } from "react";

export interface DomainLeaderboardEntry {
  domain: string;
  total: number;
  members: number;
}

export function DomainLeaderboard({
  items = [],
  compact = false,
  className = "",
}: {
  items?: DomainLeaderboardEntry[];
  compact?: boolean;
  className?: string;
}) {
  const topTotal = items[0]?.total || 1;
  const topDomain = items[0];

  return (
    <div
      className={`overflow-hidden rounded-md border border-neutral-700 bg-[linear-gradient(180deg,rgba(16,16,16,0.98),rgba(4,4,4,0.96))] shadow-[0_16px_40px_rgba(0,0,0,0.22)] ${className}`}
    >
      <div className="border-b border-neutral-700 bg-neutral-900/70 px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h4 className="text-[10px] font-bold tracking-[0.24em] text-neutral-500">DOMAIN LEADERBOARD</h4>
            <p className="mt-1 text-[11px] text-neutral-600">
              Total logged time split by domain
            </p>
          </div>
          <div className="rounded-md border border-neutral-700 bg-black/50 px-2.5 py-1 text-[10px] font-bold tracking-widest text-neutral-400">
            {items.length} DOMAINS
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-3 rounded-md border border-neutral-700 bg-black/40 px-3 py-2.5">
          <div className="min-w-0">
            <p className="text-[9px] font-bold tracking-[0.24em] text-neutral-500">LEADER</p>
            <p className="truncate text-[12px] font-bold text-white">{topDomain?.domain || "N/A"}</p>
          </div>
          <p className="flex-shrink-0 font-mono text-sm font-bold text-cyan-300">
            {topDomain ? formatDuration(topDomain.total) : "0h 0m"}
          </p>
        </div>
      </div>

      <div className={`p-4 ${compact ? "space-y-2.5" : "space-y-3.5 sm:p-5"}`}>
        {items.length === 0 ? (
          <div className="rounded-md border border-dashed border-neutral-700 bg-black/30 px-4 py-6 text-center text-[11px] text-neutral-600">
            No domain data
          </div>
        ) : (
          <div className={`grid gap-2.5 ${compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"}`}>
            {items.map((item, index) => {
              const share = Math.round((item.total / topTotal) * 100);
              const fillWidth = `${Math.max(10, share)}%`;

              return (
                <div
                  key={item.domain}
                  className="rounded-md border border-neutral-700 bg-black/50 p-3.5 transition-colors hover:border-neutral-500 hover:bg-black/70"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="mb-1.5 flex items-center gap-2">
                        <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-md border border-red/35 bg-red/15 px-1.5 text-[10px] font-bold text-red">
                          {index + 1}
                        </span>
                        <h5 className="truncate text-sm font-bold tracking-wide text-white">{item.domain}</h5>
                      </div>
                      <p className="text-[10px] font-bold tracking-wider text-neutral-500">
                        {item.members} members
                      </p>
                    </div>
                    <p className="flex-shrink-0 font-mono text-[13px] font-bold text-cyan-300">
                      {formatDuration(item.total)}
                    </p>
                  </div>

                  <div className="mt-2.5">
                    <div className="mb-1 flex items-center justify-between text-[9px] font-bold tracking-[0.18em] text-neutral-500">
                      <span>SHARE</span>
                      <span>{share}%</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-neutral-900">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-cyan-400 via-cyan-300 to-red"
                        style={{ width: fillWidth }}
                      />
                    </div>
                  </div>
                </div>
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
}: {
  activeUsers: UserStats[];
  className?: string;
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

  return (
    <div className={`flex flex-col overflow-hidden rounded-md border border-neutral-700 bg-[linear-gradient(180deg,rgba(10,10,10,0.98),rgba(2,2,2,0.96))] shadow-[0_16px_40px_rgba(0,0,0,0.22)] ${className}`}>
      {/* Header */}
      <div className="flex flex-shrink-0 items-center justify-between border-b border-neutral-700 bg-neutral-900/80 px-5 py-4">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-red animate-pulse" />
          <div>
            <span className="text-xs font-bold tracking-widest text-white">LIVE IN LAB</span>
            <p className="mt-0.5 text-[10px] text-neutral-600">Members currently clocked in</p>
          </div>
        </div>
        <span className="rounded-md border border-red/40 bg-red/10 px-2.5 py-1 text-[10px] font-bold tracking-wider text-red">
          {activeUsers.length} ACTIVE
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 border-b border-neutral-700 bg-black/45 px-4 py-3">
        <div className="rounded-md border border-neutral-700 bg-neutral-950/60 px-3 py-2">
          <p className="text-[9px] font-bold tracking-[0.2em] text-neutral-500">LONGEST</p>
          <p className="mt-1 font-mono text-sm font-bold text-cyan-300">{formatDuration(longestLiveMs)}</p>
        </div>
        <div className="rounded-md border border-neutral-700 bg-neutral-950/60 px-3 py-2">
          <p className="text-[9px] font-bold tracking-[0.2em] text-neutral-500">AVERAGE</p>
          <p className="mt-1 font-mono text-sm font-bold text-white">{formatDuration(averageLiveMs)}</p>
        </div>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 sm:p-4">
        {activeUsers.length === 0 ? (
          <div className="flex h-full items-center justify-center">
            <div className="text-center">
              <div className="mx-auto mb-3 h-3 w-3 rounded-full bg-neutral-800" />
              <p className="text-[10px] font-bold tracking-widest text-neutral-700">NO ACTIVE USERS</p>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedActiveUsers.map((user) => {
              const liveDur = Math.max(0, Date.now() - user.lastTapMs);
              return (
                <div
                  key={user.UID}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-neutral-700 bg-neutral-950/90 px-3.5 py-3 transition-colors hover:border-neutral-500 hover:bg-neutral-900"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 flex-shrink-0 rounded-full bg-red shadow-[0_0_12px_rgba(194,0,0,0.7)]" />
                      <p className="truncate text-sm font-bold text-white">{user.Name}</p>
                    </div>
                    <p className="mt-1 text-[10px] font-mono text-neutral-600">
                      IN @ {new Date(user.lastTapMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                  <p className="flex-shrink-0 rounded-md border border-red/30 bg-red/5 px-3 py-1.5 font-mono text-sm font-bold text-red">
                    {formatDuration(liveDur)}
                  </p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
