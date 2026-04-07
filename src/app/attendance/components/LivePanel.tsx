"use client";

import { UserStats, formatDuration } from "../logic";
import { useEffect, useState } from "react";

export function LivePanel({ activeUsers }: { activeUsers: UserStats[] }) {
  const [, setTick] = useState(0);

  useEffect(() => {
    const iv = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(iv);
  }, []);

  return (
    <div className="bg-black border border-neutral-800 h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-5 py-4 border-b border-neutral-800 bg-neutral-900/80 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 bg-red animate-pulse" />
          <span className="text-xs font-bold text-white tracking-widest">LIVE</span>
        </div>
        <span className="text-[10px] font-bold text-red tracking-wider">
          {activeUsers.length} ACTIVE
        </span>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {activeUsers.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="w-3 h-3 bg-neutral-800 mx-auto mb-3" />
              <p className="text-[10px] text-neutral-700 tracking-widest font-bold">NO ACTIVE USERS</p>
            </div>
          </div>
        ) : (
          activeUsers.map((user) => {
            const liveDur = Math.max(0, Date.now() - user.lastTapMs);
            return (
              <div key={user.UID} className="flex items-center justify-between px-4 py-3 bg-neutral-950 border-l-2 border-red hover:bg-neutral-900 transition-colors">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-white truncate">{user.Name}</p>
                  <p className="text-[9px] text-neutral-600 font-mono mt-0.5">
                    IN @ {new Date(user.lastTapMs).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
                <p className="text-sm font-bold text-red font-mono flex-shrink-0 ml-3">{formatDuration(liveDur)}</p>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
