"use client";

import { useState, useMemo } from "react";
import { UserStats, formatDuration } from "../logic";
import { Search } from "lucide-react";
import { ATTENDANCE_CONFIG } from "../attendance.config";

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
          const domainA = a.Domain || ATTENDANCE_CONFIG.DEFAULT_DOMAIN;
          const domainB = b.Domain || ATTENDANCE_CONFIG.DEFAULT_DOMAIN;
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
    <div className="bg-black/40 border border-neutral-800">
      {/* Header & Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 border-b border-neutral-800 gap-4">
        <div className="flex items-center gap-4 flex-shrink-0">
          <h3 className="text-[10px] text-neutral-500 font-bold tracking-widest uppercase">
             <span className="ml-2 px-2 py-0.5 bg-neutral-900 border border-neutral-800 rounded-full">{loading ? "Loading..." : `${users.length} members`}</span>
          </h3>
          
          {/* <div className="relative">
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortOption)}
              className="bg-neutral-900/50 border border-neutral-800 text-[10px] text-neutral-300 px-3 py-1 pr-8 focus:outline-none focus:border-red/50 transition-colors appearance-none"
            >
              <option value="hours">Sort by Hours</option>
              <option value="domain">Sort by Domain</option>
              <option value="name">Sort by Name</option>
            </select>
            <ChevronDown size={12} className="absolute right-2 top-1/2 transform -translate-y-1/2 text-neutral-500 pointer-events-none" />
          </div> */}
        </div>
        
        <div className="relative w-full sm:w-64">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <Search size={14} className="text-neutral-500" />
          </div>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            disabled={loading}
            className="w-full bg-neutral-900/50 border border-neutral-800 text-sm text-white pl-9 pr-3 py-2 placeholder-neutral-600 focus:outline-none focus:border-red/50 transition-colors disabled:cursor-not-allowed disabled:opacity-60"
          />
        </div>
      </div>

      {/* Desktop Table Header */}
      <div className="hidden sm:grid grid-cols-[80px_1fr_140px_110px_150px] border-b border-neutral-800 bg-neutral-900/40">
        <div className="px-6 py-4 text-[10px] text-neutral-500 font-bold tracking-widest uppercase">
          #
        </div>
        <div className="px-6 py-4 text-[10px] text-neutral-500 font-bold tracking-widest uppercase">
          Name
        </div>
        <div className="px-6 py-4 text-[10px] text-neutral-500 font-bold tracking-widest uppercase">
          Domain
        </div>
        <div className="px-6 py-4 text-[10px] text-neutral-500 font-bold tracking-widest uppercase">
          Hours
        </div>
        <div className="px-6 py-4 text-[10px] text-neutral-500 font-bold tracking-widest uppercase">
          Status
        </div>
      </div>

      {/* Rows */}
      <div className="flex flex-col">
        {loading ? (
          <>
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={`skeleton-desktop-${i}`} className="hidden sm:grid grid-cols-[80px_1fr_140px_110px_150px] items-center border-b border-neutral-800/50 table-skeleton-row">
                <div className="px-6 py-4">
                  <div className="h-3 w-7 rounded-sm bg-neutral-800/80 table-skeleton-block" />
                </div>
                <div className="px-6 py-4">
                  <div className="h-4 w-3/5 rounded-sm bg-neutral-800/80 table-skeleton-block" />
                </div>
                <div className="px-6 py-4">
                  <div className="h-3 w-2/3 rounded-sm bg-neutral-800/80 table-skeleton-block" />
                </div>
                <div className="px-6 py-4">
                  <div className="h-3 w-16 rounded-sm bg-neutral-800/80 table-skeleton-block" />
                </div>
                <div className="px-6 py-4">
                  <div className="h-6 w-20 rounded-sm border border-neutral-700 bg-neutral-900/80 table-skeleton-block" />
                </div>
              </div>
            ))}

            {Array.from({ length: 5 }).map((_, i) => (
              <div key={`skeleton-mobile-${i}`} className="sm:hidden p-4 border-b border-neutral-800/50 table-skeleton-row">
                <div className="mb-2 h-4 w-3/4 rounded-sm bg-neutral-800/80 table-skeleton-block" />
                <div className="mb-2 h-3 w-1/3 rounded-sm bg-neutral-800/80 table-skeleton-block" />
                <div className="h-3 w-1/2 rounded-sm bg-neutral-800/80 table-skeleton-block" />
              </div>
            ))}
          </>
        ) : filteredAndSortedUsers.length === 0 ? (
          <div className="p-8 text-center text-neutral-500 text-sm">
            No members found matching &quot;{search}&quot;
          </div>
        ) : (
          filteredAndSortedUsers.map((user) => {
            // True rank is just the index in the original sorted users array
            const trueRank = users.findIndex(u => u.UID === user.UID) + 1;
            
            return (
              <div 
                key={user.UID}
                onClick={() => onRowClick && onRowClick(user.UID, user.Name)}
                className="group border-b border-neutral-800/50 hover:bg-neutral-900 transition-colors cursor-pointer"
              >
                {/* Mobile View */}
                <div className="sm:hidden p-4 flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-bold text-red bg-red/10 px-1.5 py-0.5 rounded-sm">#{trueRank}</span>
                      <span className="text-white font-bold">{user.Name}</span>
                      {user.currentStreak >= 2 && (
                         <span className="text-[10px] text-orange-500 font-bold tracking-wider" title={`${user.currentStreak} Day Streak`}>🔥 {user.currentStreak}</span>
                      )}
                    </div>
                    <div className="mb-1">
                      <span className="text-[10px] font-bold tracking-wider text-cyan-400/90">
                        {user.Domain || ATTENDANCE_CONFIG.DEFAULT_DOMAIN}
                      </span>
                    </div>
                    <span className="text-sm font-mono text-neutral-400">{formatDuration(user.overallTotalTimeMs)}</span>
                  </div>
                  <div>
                    <span className={`text-[10px] sm:text-xs font-bold px-2 sm:px-3 py-1 sm:py-1.5 tracking-wider border ${
                      user.status === "IN"
                        ? "text-red border-red/30 bg-red/5"
                        : "text-neutral-500 border-neutral-800 bg-neutral-900/50"
                    }`}>
                      {user.status === "IN" ? "■ IN LAB" : "OUT"}
                    </span>
                  </div>
                </div>

                {/* Desktop View */}
                <div className="hidden sm:grid grid-cols-[80px_1fr_140px_110px_150px] items-center">
                  <div className="px-6 py-4">
                    <span className={`text-xs font-bold ${trueRank <= 3 ? 'text-red bg-red/10 px-2 py-1 rounded-sm' : 'text-neutral-500'}`}>
                      {trueRank}
                    </span>
                  </div>
                  <div className="px-6 py-4 flex items-center gap-2">
                    <span className="text-sm font-bold text-white group-hover:text-red transition-colors">{user.Name}</span>
                    {user.currentStreak >= 2 && (
                       <span className="text-[10px] text-orange-500 font-bold tracking-wider" title={`${user.currentStreak} Day Streak`}>🔥 {user.currentStreak}</span>
                    )}
                  </div>
                  <div className="px-6 py-4">
                    <span className="text-[11px] font-bold tracking-wider text-cyan-400/90">
                      {user.Domain || ATTENDANCE_CONFIG.DEFAULT_DOMAIN}
                    </span>
                  </div>
                  <div className="px-6 py-4">
                    <span className="text-sm font-mono font-bold text-neutral-400">{formatDuration(user.overallTotalTimeMs)}</span>
                  </div>
                  <div className="px-6 py-4">
                     <span className={`text-[10px] font-bold px-3 py-1.5 tracking-wider border ${
                      user.status === "IN"
                        ? "text-red border-red/30 bg-red/5"
                        : "text-neutral-500 border-neutral-800 bg-neutral-900/50"
                    }`}>
                      {user.status === "IN" ? "■ IN LAB" : "OUT"}
                    </span>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
