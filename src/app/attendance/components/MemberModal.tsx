"use client";

import { X } from "lucide-react";
import { TapLog } from "../logic";

interface MemberModalProps {
  isOpen: boolean;
  onClose: () => void;
  uid: string;
  name: string;
  logs: TapLog[];
}

export function MemberModal({ isOpen, onClose, uid, name, logs }: MemberModalProps) {
  if (!isOpen) return null;

  // Filter logs just for this member, sorted newest first
  const memberLogs = logs
    .filter(log => log.UID === uid)
    .sort((a, b) => b.timestamp - a.timestamp);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-neutral-950 border border-neutral-800 w-full max-w-lg shadow-[0_0_50px_rgba(194,0,0,0.1)]">
        {/* Header */}
        <div className="border-b border-neutral-800 p-4 sm:p-6 flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide border-l-4 border-red pl-3">
              {name}
            </h2>
            <p className="text-xs text-neutral-500 font-mono mt-1 opacity-50">UID: {uid}</p>
          </div>
          <button 
            onClick={onClose}
            className="text-neutral-500 hover:text-white transition-colors"
          >
            <X size={24} />
          </button>
        </div>

        {/* Content - Log History */}
        <div className="p-4 sm:p-6 max-h-[50vh] overflow-y-auto no-scrollbar">
          <h3 className="text-[10px] text-neutral-500 font-bold mb-4 tracking-widest uppercase">
            Recent Scans
          </h3>
          
          <div className="space-y-3">
            {memberLogs.length === 0 ? (
              <p className="text-sm text-neutral-600">No scans found.</p>
            ) : (
              memberLogs.map((log, i) => (
                <div key={i} className="flex items-center justify-between bg-black border border-neutral-900 p-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-medium text-white">{log.Date}</span>
                    <span className="text-xs text-neutral-500">{log.Time}</span>
                  </div>
                  {log.action ? (
                    <span className={`text-[10px] font-bold px-2 py-1 tracking-wider ${
                      log.action === "IN" ? "text-green-500 bg-green-500/10" : "text-neutral-400 bg-neutral-800"
                    }`}>
                      {log.action}
                    </span>
                  ) : (
                    <span className="text-[10px] text-neutral-600 font-mono font-bold tracking-widest">TAP</span>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-neutral-800 p-4 sm:p-6 flex justify-end">
          <button 
            onClick={onClose}
            className="px-6 py-2 bg-neutral-900 text-white text-xs font-bold tracking-widest hover:bg-neutral-800 transition-colors"
          >
            CLOSE
          </button>
        </div>
      </div>
    </div>
  );
}
