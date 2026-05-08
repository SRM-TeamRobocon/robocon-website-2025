"use client";

import { X } from "lucide-react";
import { TapLog } from "../logic";
import { motion, AnimatePresence } from "framer-motion";

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
    <AnimatePresence>
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md p-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="bg-gradient-to-br from-zinc-900/90 to-zinc-950/90 backdrop-blur-2xl border border-zinc-800/60 w-full max-w-lg shadow-[0_0_50px_rgba(239,68,68,0.1)] rounded-2xl overflow-hidden relative"
        >
          {/* Top accent line */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500/80 via-red-500/40 to-transparent"></div>

          {/* Header */}
          <div className="border-b border-zinc-800/60 p-5 sm:p-6 flex items-center justify-between bg-zinc-900/30">
            <div>
              <div className="flex items-center gap-3">
                <span className="w-1.5 h-6 bg-red-500 rounded-full shadow-[0_0_10px_rgba(239,68,68,0.5)]"></span>
                <h2 className="text-xl sm:text-2xl font-bold text-white tracking-wide">
                  {name}
                </h2>
              </div>
              <p className="text-xs text-zinc-500 font-mono mt-1.5 ml-4.5 tracking-wider uppercase">OPERATOR ID: <span className="text-zinc-400">{uid}</span></p>
            </div>
            <button 
              onClick={onClose}
              className="text-zinc-500 hover:text-white hover:bg-zinc-800/50 p-2 rounded-full transition-all duration-200"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content - Log History */}
          <div className="p-5 sm:p-6 max-h-[50vh] overflow-y-auto no-scrollbar relative">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[10px] text-zinc-400 font-bold tracking-[0.2em] uppercase">
                TELEMETRY LOGS
              </h3>
              <span className="text-[10px] text-zinc-500 font-mono">{memberLogs.length} ENTRIES</span>
            </div>
            
            <div className="space-y-3">
              {memberLogs.length === 0 ? (
                <div className="p-8 border border-dashed border-zinc-800 rounded-xl bg-zinc-900/20 text-center">
                  <p className="text-sm text-zinc-500 font-mono">No telemetry data found.</p>
                </div>
              ) : (
                memberLogs.map((log, i) => (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    key={i} 
                    className="flex items-center justify-between bg-zinc-900/40 border border-zinc-800/50 hover:border-zinc-700/50 transition-colors p-3.5 rounded-xl group"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-bold text-zinc-100 group-hover:text-white transition-colors">{log.Date}</span>
                      <span className="text-xs font-mono text-zinc-500 mt-0.5">{log.Time}</span>
                    </div>
                    {log.action ? (
                      <span className={`text-[10px] font-bold px-2.5 py-1 tracking-widest rounded-md border ${
                        log.action === "IN" 
                          ? "text-red-400 bg-red-500/10 border-red-500/20" 
                          : "text-zinc-400 bg-zinc-800/50 border-zinc-700/50"
                      }`}>
                        {log.action}
                      </span>
                    ) : (
                      <span className="text-[10px] text-cyan-500/80 font-mono font-bold tracking-widest border border-cyan-500/20 bg-cyan-500/10 px-2 py-1 rounded-md">TAP</span>
                    )}
                  </motion.div>
                ))
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t border-zinc-800/60 p-5 sm:p-6 flex justify-end bg-zinc-900/30">
            <button 
              onClick={onClose}
              className="px-6 py-2.5 bg-zinc-800 text-zinc-300 text-[11px] font-bold tracking-widest rounded-lg hover:bg-zinc-700 hover:text-white transition-all duration-200 border border-zinc-700"
            >
              CLOSE TERMINAL
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
