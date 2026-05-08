"use client";

import { useState, useMemo } from "react";
import { UserStats, formatDuration } from "../logic";
import { Search } from "lucide-react";
import { motion } from "framer-motion";

const DEFAULT_DOMAIN = "GENERAL";

interface LeaderboardTableProps {
  users: UserStats[];
  loading?: boolean;
  onRowClick?: (uid: string, name: string) => void;
}

type SortOption = "hours" | "domain" | "name";

export function LeaderboardTable({ users, loading = false, onRowClick }: LeaderboardTableProps) {
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("hours");

  const filteredAndSortedUsers = useMemo(() => {
    let result = users;

    // Search filter
    if (search.trim() !== "") {
      const q = search.toLowerCase();
      result = result.filter(u => u.Name.toLowerCase().includes(q));
    }

    // Sort
    result = [...result].sort((a, b) => {
      switch (sortBy) {
        case "domain":
          const domainA = a.Domain || DEFAULT_DOMAIN;
          const domainB = b.Domain || DEFAULT_DOMAIN;
          if (domainA !== domainB) return domainA.localeCompare(domainB);
          return b.overallTotalTimeMs - a.overallTotalTimeMs;
        case "name":
          return a.Name.localeCompare(b.Name);
        case "hours":
        default:
          return b.overallTotalTimeMs - a.overallTotalTimeMs;
      }
    });

    return result;
  }, [users, search, sortBy]);

  return (
    <div className="bg-gradient-to-br from-zinc-900/60 via-zinc-900/40 to-zinc-950/60 backdrop-blur-xl border border-zinc-800/40 rounded-2xl overflow-hidden shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 sm:p-6 border-b border-zinc-800/40 gap-4 relative">
        <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-red-500/50 via-red-500/10 to-transparent"></div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <h3 className="text-[10px] text-zinc-400 font-bold tracking-[0.2em] uppercase flex items-center gap-2">
            MEMBERS 
            <span className="px-2.5 py-1 bg-zinc-900/80 border border-zinc-700/50 rounded-md text-cyan-400">{loading ? "..." : users.length}</span>
          </h3>
        </div>
        
        <div className="relative w-full sm:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={14} className="text-zinc-500" />
          </div>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={loading}
            className="w-full bg-zinc-900/50 border border-zinc-700/50 rounded-lg text-sm text-white pl-9 pr-3 py-2 placeholder-zinc-600 focus:outline-none focus:border-red-500/50 focus:ring-1 focus:ring-red-500/50 transition-all disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
      </div>

      {/* Desktop Table Header */}
      <div className="hidden sm:grid grid-cols-[80px_1fr_140px_110px_150px] border-b border-zinc-800/40 bg-zinc-900/30">
        <div className="px-6 py-4 text-[10px] text-zinc-500 font-bold tracking-widest uppercase">
          RANK
        </div>
        <div className="px-6 py-4 text-[10px] text-zinc-500 font-bold tracking-widest uppercase">
          OPERATOR
        </div>
        <div className="px-6 py-4 text-[10px] text-zinc-500 font-bold tracking-widest uppercase">
          DOMAIN
        </div>
        <div className="px-6 py-4 text-[10px] text-zinc-500 font-bold tracking-widest uppercase">
          TIME
        </div>
        <div className="px-6 py-4 text-[10px] text-zinc-500 font-bold tracking-widest uppercase">
          STATUS
        </div>
      </div>

      {/* Rows */}
      <div className="flex flex-col">
        {loading ? (
          <>
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={`skeleton-desktop-${i}`} className="hidden sm:grid grid-cols-[80px_1fr_140px_110px_150px] items-center border-b border-zinc-800/30">
                <div className="px-6 py-4">
                  <div className="h-3 w-7 rounded-md bg-zinc-800/60 attendance-skeleton-block" />
                </div>
                <div className="px-6 py-4">
                  <div className="h-4 w-3/5 rounded-md bg-zinc-800/60 attendance-skeleton-block" />
                </div>
                <div className="px-6 py-4">
                  <div className="h-3 w-2/3 rounded-md bg-zinc-800/60 attendance-skeleton-block" />
                </div>
                <div className="px-6 py-4">
                  <div className="h-3 w-16 rounded-md bg-zinc-800/60 attendance-skeleton-block" />
                </div>
                <div className="px-6 py-4">
                  <div className="h-6 w-20 rounded-md border border-zinc-700/50 bg-zinc-900/50 attendance-skeleton-block" />
                </div>
              </div>
            ))}

            {Array.from({ length: 5 }).map((_, i) => (
              <div key={`skeleton-mobile-${i}`} className="sm:hidden p-4 border-b border-zinc-800/30">
                <div className="mb-2 h-4 w-3/4 rounded-md bg-zinc-800/60 attendance-skeleton-block" />
                <div className="mb-2 h-3 w-1/3 rounded-md bg-zinc-800/60 attendance-skeleton-block" />
                <div className="h-3 w-1/2 rounded-md bg-zinc-800/60 attendance-skeleton-block" />
              </div>
            ))}
          </>
        ) : filteredAndSortedUsers.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-sm">
            No members found matching <span className="text-zinc-400 font-bold">"{search}"</span>
          </div>
        ) : (
          filteredAndSortedUsers.map((user, i) => {
            const trueRank = users.findIndex(u => u.UID === user.UID) + 1;
            
            // Define rank-specific shiny styles
            const isTop3 = trueRank <= 3;
            let rankStyles = "text-zinc-500 bg-zinc-800/50 border-zinc-800";
            let rowEffect = "";
            
            if (trueRank === 1) {
              rankStyles = "bg-gradient-to-br from-zinc-100 via-white to-zinc-300 text-zinc-950 shadow-[0_0_15px_rgba(255,255,255,0.4)] border-zinc-100 font-black";
              rowEffect = "after:content-[''] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-white/5 after:to-transparent after:skew-x-[-20deg] after:animate-[shimmer_5s_infinite]";
            } else if (trueRank === 2) {
              rankStyles = "bg-gradient-to-br from-amber-300 via-yellow-100 to-amber-500 text-amber-950 shadow-[0_0_15px_rgba(245,158,11,0.4)] border-amber-400 font-black";
              rowEffect = "after:content-[''] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-white/5 after:to-transparent after:skew-x-[-20deg] after:animate-[shimmer_6s_infinite]";
            } else if (trueRank === 3) {
              rankStyles = "bg-gradient-to-br from-slate-300 via-slate-100 to-slate-500 text-slate-950 shadow-[0_0_10px_rgba(148,163,184,0.4)] border-slate-400 font-black";
              rowEffect = "after:content-[''] after:absolute after:inset-0 after:bg-gradient-to-r after:from-transparent after:via-white/5 after:to-transparent after:skew-x-[-20deg] after:animate-[shimmer_7s_infinite]";
            }

            return (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: Math.min(i * 0.05, 0.5) }}
                key={user.UID}
                onClick={() => onRowClick && onRowClick(user.UID, user.Name)}
                className={`group border-b border-zinc-800/30 hover:bg-zinc-800/40 transition-all duration-200 cursor-pointer relative overflow-hidden ${rowEffect}`}
              >
                {/* Mobile View */}
                <div className="sm:hidden p-4.5 flex items-center justify-between">
                  <div className="flex-1 min-w-0 pr-4">
                    <div className="flex items-center gap-2.5 mb-2">
                      <span className={`flex-shrink-0 text-[10px] px-2 py-0.5 rounded-md border ${rankStyles}`}>
                        #{trueRank}
                      </span>
                      <span className="text-sm font-black text-white tracking-wide truncate uppercase">{user.Name}</span>
                      {user.currentStreak >= 2 && (
                         <span className="flex-shrink-0 text-[10px] text-orange-400 font-black tracking-tighter bg-orange-500/10 px-1.5 py-0.5 rounded-md border border-orange-500/20">
                           🔥 {user.currentStreak}
                         </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-[9px] font-black tracking-[0.1em] text-cyan-400/90 uppercase bg-cyan-400/5 px-2 py-0.5 rounded-md border border-cyan-400/20">
                        {user.Domain || DEFAULT_DOMAIN}
                      </span>
                      <span className="text-xs font-mono font-black text-zinc-100">{formatDuration(user.overallTotalTimeMs)}</span>
                    </div>
                  </div>
                  <div className="flex-shrink-0">
                    <span className={`text-[9px] font-black px-3 py-2 tracking-[0.15em] border rounded-lg shadow-sm ${
                      user.status === "IN"
                        ? "text-red-400 border-red-500/40 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
                        : "text-zinc-500 border-zinc-800 bg-zinc-950/50"
                    }`}>
                      {user.status === "IN" ? "■ IN LAB" : "OFFLINE"}
                    </span>
                  </div>
                </div>

                {/* Desktop View */}
                <div className="hidden sm:grid grid-cols-[100px_1fr_160px_130px_160px] items-center h-16">
                  <div className="px-6">
                    <span className={`inline-flex items-center justify-center min-w-[36px] text-xs px-2.5 py-1 rounded-lg border ${rankStyles}`}>
                      #{trueRank}
                    </span>
                  </div>
                  <div className="px-6 flex items-center gap-3">
                    <span className="text-sm font-black text-zinc-100 group-hover:text-white transition-colors uppercase tracking-tight">{user.Name}</span>
                    {user.currentStreak >= 2 && (
                       <span className="text-[10px] text-orange-400 font-black tracking-wider bg-orange-500/10 px-2 py-0.5 rounded-md border border-orange-500/20 shadow-sm" title={`${user.currentStreak} Day Streak`}>
                         🔥 {user.currentStreak}
                       </span>
                    )}
                  </div>
                  <div className="px-6">
                    <span className="inline-block text-[10px] font-black tracking-[0.12em] text-cyan-400/80 uppercase bg-cyan-400/5 px-2.5 py-1 rounded-md border border-cyan-400/20">
                      {user.Domain || DEFAULT_DOMAIN}
                    </span>
                  </div>
                  <div className="px-6">
                    <span className="text-sm font-mono font-black text-zinc-100 group-hover:text-cyan-300 transition-colors">{formatDuration(user.overallTotalTimeMs)}</span>
                  </div>
                  <div className="px-6">
                     <span className={`inline-block text-[10px] font-black px-4 py-2 tracking-[0.15em] border rounded-lg transition-all duration-300 ${
                      user.status === "IN"
                        ? "text-red-400 border-red-500/40 bg-red-500/10 shadow-[0_0_20px_rgba(239,68,68,0.1)] relative overflow-hidden group-hover:border-red-500/60"
                        : "text-zinc-500 border-zinc-800/80 bg-zinc-950/40 group-hover:border-zinc-700"
                    }`}>
                      {user.status === "IN" && (
                        <span className="absolute inset-0 bg-red-500/10 animate-pulse pointer-events-none" />
                      )}
                      {user.status === "IN" ? "■ IN LAB" : "OFFLINE"}
                    </span>
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>
    </div>
  );
}

