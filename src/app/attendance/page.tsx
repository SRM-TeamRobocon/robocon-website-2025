"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import Image from "next/image";
import { Download } from "lucide-react";
import { motion } from "framer-motion";
import { TapLog, UserStats, ParseAttendanceResult, parseCSV, parseData, calculateStats, formatDuration, getAvailableMonths, filterLogsByMonth, generateSessionCSV } from "./logic";
import { HeroCards } from "./components/HeroCards";
import { LeaderboardTable } from "./components/LeaderboardTable";
import { DomainLeaderboard, LivePanel, type DomainLeaderboardEntry } from "./components/LivePanel";
import { ActivityChart } from "./components/ActivityChart";
import { MemberModal } from "./components/MemberModal";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function AttendanceDashboard() {
  const [allLogs, setAllLogs] = useState<TapLog[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<UserStats[]>([]);
  const [globalUsers, setGlobalUsers] = useState<UserStats[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [parseWarning, setParseWarning] = useState<string | null>(null);
  
  // Filters
  const [selectedMonth, setSelectedMonth] = useState<string | null>(() => {
    if (typeof window !== "undefined") {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    }
    return null;
  });
  const [selectedWeek, setSelectedWeek] = useState<number | null>(null);

  // Member Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [modalUser, setModalUser] = useState<{ uid: string; name: string } | null>(null);

  // Domain filter
  const [selectedDomain, setSelectedDomain] = useState<string | null>(null);

  // Live Modal State
  const [liveModalOpen, setLiveModalOpen] = useState(false);

  // Live Toast State
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const prevActiveRef = useRef<Set<string>>(new Set());

  const buildSortedStats = useCallback((logs: TapLog[], nowMs: number) => {
    const stats = calculateStats(logs, nowMs);
    stats.sort((a, b) => b.overallTotalTimeMs - a.overallTotalTimeMs);
    return stats;
  }, []);

  const recalculate = useCallback((logs: TapLog[], monthKey: string | null, weekKey: number | null) => {
    const nowMs = Date.now();
    const filteredLogs = filterLogsByMonth(logs, monthKey, weekKey);
    const globalStats = buildSortedStats(logs, nowMs);
    const scopedStats = buildSortedStats(filteredLogs, nowMs);

    setGlobalUsers(globalStats);
    setFilteredUsers(scopedStats);

    // Check for new live entries globally (ignores month/week filters).
    const currentActive = new Set(globalStats.filter(u => u.status === "IN").map(u => u.UID));
    if (prevActiveRef.current.size > 0 && currentActive.size > prevActiveRef.current.size) {
      for (const uid of Array.from(currentActive)) {
        if (!prevActiveRef.current.has(uid)) {
          const user = globalStats.find(u => u.UID === uid);
          if (user) {
            setToastMessage(`🤖 ${user.Name} has entered the lab.`);
            setTimeout(() => setToastMessage(null), 5000);
          }
        }
      }
    }
    prevActiveRef.current = currentActive;
  }, [buildSortedStats]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance?t=${Date.now()}`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const text = await res.text();
      
      let parsedResult: ParseAttendanceResult;
      try {
        parsedResult = parseData(JSON.parse(text));
      } catch {
        parsedResult = parseCSV(text);
      }
      const logs = parsedResult.logs;
      if (logs.length === 0) throw new Error("No valid rows found in sheet");

      const { skippedRows, skippedSamples } = parsedResult.diagnostics;
      if (skippedRows > 0) {
        const rowWord = skippedRows === 1 ? "row was" : "rows were";
        const sampleText = skippedSamples.length > 0
          ? ` Example: ${skippedSamples.join(" | ")}`
          : "";
        setParseWarning(`${skippedRows} ${rowWord} skipped due to invalid format.${sampleText}`);
      } else {
        setParseWarning(null);
      }

      setAllLogs(logs);
      recalculate(logs, selectedMonth, selectedWeek);
      setError(null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to fetch attendance data";
      console.error("Fetch failed:", message);
      setError(message);
      setParseWarning(null);
    } finally {
      setLastRefresh(new Date());
      setLoading(false);
    }
  }, [recalculate, selectedMonth, selectedWeek]);

  // Reset week when month changes
  useEffect(() => {
    setSelectedWeek(null);
  }, [selectedMonth]);

  useEffect(() => {
    if (allLogs.length > 0) {
      recalculate(allLogs, selectedMonth, selectedWeek);
    }
  }, [allLogs, recalculate, selectedMonth, selectedWeek]);

  useEffect(() => {
    fetchData();
    // Removed auto-sync interval as requested
  }, [fetchData]);

  const handleDownload = () => {
    const logs = filterLogsByMonth(allLogs, selectedMonth, selectedWeek);
    const csv = generateSessionCSV(logs);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    
    let filename = "attendance";
    if (selectedMonth) filename += "_" + selectedMonth;
    else filename += "_allTime";
    if (selectedWeek) filename += "_week" + selectedWeek;
    
    a.download = `${filename}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const active = globalUsers.filter(u => u.status === "IN");
  const totalMs = filteredUsers.reduce((s, u) => s + u.overallTotalTimeMs, 0);
  const availableMonths = getAvailableMonths(allLogs);

  // Exclude TEAM from domain ranking and domain-filter tabs.
  const availableDomains = Array.from(
    new Set(
      filteredUsers
        .map(u => (u.Domain || "").trim().toUpperCase())
        .filter(domain => domain && domain !== "TEAM")
    )
  ).sort();

  const domainTotalsMap = new Map<string, { total: number; members: number }>();
  filteredUsers.forEach(u => {
    const domain = (u.Domain || "UNKNOWN").trim().toUpperCase();
    if (domain === "TEAM") return;

    const current = domainTotalsMap.get(domain) || { total: 0, members: 0 };
    current.total += u.overallTotalTimeMs;
    current.members += 1;
    domainTotalsMap.set(domain, current);
  });

  const domainLeaderboard = Array.from(domainTotalsMap.entries())
    .map(([domain, stats]) => ({ domain, total: stats.total, members: stats.members }))
    .sort((a, b) => b.total - a.total);

  return (
    <div className="min-h-screen flex flex-col robocon-theme-bg text-white relative">
      <Header />
      
      {/* ── Secondary Telemetry Header ── */}
      <header className="bg-black/60 backdrop-blur-xl border-b border-zinc-800/50 sticky top-0 z-40 shadow-2xl transition-all duration-300">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between py-3 sm:py-0 sm:h-20 gap-3 sm:gap-4">
            <div className="flex items-center justify-between w-full sm:w-auto gap-4">
              <div className="flex items-center gap-4">
                <div className="w-px h-8 bg-gradient-to-b from-transparent via-red-500 to-transparent shadow-[0_0_10px_rgba(239,68,68,0.8)]" />
                <div className="flex flex-col">
                  <span className="text-[10px] sm:text-xs font-black tracking-[0.4em] text-zinc-100 uppercase">TELEMETRY</span>
                  <span className="text-[8px] sm:text-[9px] font-black tracking-[0.2em] text-zinc-500 uppercase">DASHBOARD_v2.0</span>
                </div>
              </div>
              
              {/* Mobile Live Button */}
              <button
                onClick={() => setLiveModalOpen(true)}
                className="lg:hidden flex items-center gap-2 px-4 py-2 bg-red-500/10 border border-red-500/40 rounded-full text-red-400 text-[10px] font-black tracking-widest hover:bg-red-500/20 transition-all active:scale-95"
              >
                <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                LIVE ({active.length})
              </button>
            </div>

            {/* Telemetry Stats - Responsive */}
            <div className="flex items-center justify-around w-full sm:w-auto sm:gap-12 border-t border-zinc-800/30 sm:border-0 pt-4 sm:pt-0">
              <StatItem label="In Lab" value={active.length.toString()} accent />
              <div className="w-px h-10 bg-zinc-800/30 sm:hidden" />
              <StatItem label="Total Hours" value={formatDuration(totalMs)} />
              <div className="w-px h-10 bg-zinc-800/30 sm:hidden" />
              <StatItem label="Members" value={filteredUsers.length.toString()} />
            </div>

            {/* Right Controls - Desktop */}
            <div className="hidden sm:flex items-center gap-6">
              <div className="flex flex-col items-end">
                <span className="text-[9px] text-zinc-500 font-mono tracking-widest uppercase">SYSTEM_CLOCK</span>
                <span className="text-[11px] text-zinc-300 font-mono tracking-widest">{lastRefresh.toLocaleTimeString()}</span>
              </div>
              
              <button
                onClick={fetchData}
                disabled={loading}
                className="h-10 px-6 bg-white text-black text-[10px] font-black tracking-[0.2em] hover:bg-zinc-200 transition-all disabled:opacity-50 shadow-[0_0_20px_rgba(255,255,255,0.15)] rounded-sm uppercase"
              >
                {loading ? "SYNCING" : "RE-SYNC"}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Premium Content Layout ── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        {/* Error Alert - Premium Styling */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-xl bg-gradient-to-r from-red-500/10 via-red-500/5 to-transparent border border-red-500/30 p-4 backdrop-blur-sm"
          >
            <p className="text-xs text-red-400 font-bold tracking-wider uppercase">⚠ Connection Error</p>
            <p className="text-[11px] text-red-300/80 mt-1.5 font-medium">{error}</p>
          </motion.div>
        )}
        
        {/* Data Quality Warning - Premium Styling */}
        {parseWarning && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 rounded-xl bg-gradient-to-r from-amber-500/10 via-amber-500/5 to-transparent border border-amber-500/30 p-4 backdrop-blur-sm"
          >
            <p className="text-xs text-amber-400 font-bold tracking-wider uppercase">⚠ Partial Data</p>
            <p className="text-[11px] text-amber-300/80 mt-1.5 font-medium">{parseWarning}</p>
          </motion.div>
        )}

        {/* ── Premium Filter & Export Controls ── */}
        <div className="mb-8 sm:mb-10 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedMonth(null)}
              className={`px-3 sm:px-4 py-2 text-[10px] sm:text-xs font-bold tracking-wider rounded-lg border transition-all duration-200 ${
                selectedMonth === null
                  ? "bg-red-500/20 text-red-300 border-red-500/50 shadow-lg shadow-red-500/20"
                  : "bg-zinc-900/40 text-zinc-400 border-zinc-700/50 hover:bg-zinc-800/50 hover:text-zinc-300 hover:border-zinc-600/50"
              }`}
            >
              ALL TIME
            </button>
            {availableMonths.map(m => (
              <motion.button
                key={m.key}
                whileHover={{ scale: 1.02 }}
                onClick={() => setSelectedMonth(m.key)}
                className={`px-3 sm:px-4 py-2 text-[10px] sm:text-xs font-bold tracking-wider rounded-lg border transition-all duration-200 ${
                  selectedMonth === m.key
                    ? "bg-red-500/20 text-red-300 border-red-500/50 shadow-lg shadow-red-500/20"
                    : "bg-zinc-900/40 text-zinc-400 border-zinc-700/50 hover:bg-zinc-800/50 hover:text-zinc-300 hover:border-zinc-600/50"
                }`}
              >
                {m.label.toUpperCase()}
              </motion.button>
            ))}

            {selectedMonth && (
               <select 
                 value={selectedWeek || ""} 
                 onChange={e => setSelectedWeek(e.target.value ? Number(e.target.value) : null)}
                 className="bg-zinc-900/40 text-zinc-300 border border-zinc-700/50 hover:border-zinc-600/50 px-3 py-2 text-[10px] sm:text-xs font-bold tracking-wider focus:outline-none focus:border-red-500/50 transition-colors ml-0 sm:ml-2 rounded-lg"
               >
                 <option value="">ALL WEEKS</option>
                 <option value="1">WEEK 1 (1st-7th)</option>
                 <option value="2">WEEK 2 (8th-14th)</option>
                 <option value="3">WEEK 3 (15th-21st)</option>
                 <option value="4">WEEK 4 (22nd-28th)</option>
                 <option value="5">WEEK 5 (29th+)</option>
               </select>
             )}
          </div>

          <motion.button 
             whileHover={{ scale: 1.02 }}
             onClick={handleDownload}
             className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg border border-blue-500/40 bg-gradient-to-r from-blue-500/20 to-blue-500/10 text-blue-300 hover:from-blue-500/30 hover:to-blue-500/20 transition-all duration-200 text-[10px] sm:text-xs font-bold tracking-widest shrink-0"
          >
             <Download size={14} /> EXPORT CSV
          </motion.button>
        </div>

        <div className="space-y-8 sm:space-y-10">
          <section>
            <SectionHeader>Top Performers</SectionHeader>
            <HeroCards topUsers={filteredUsers.slice(0, 3)} loading={loading} />
          </section>
          
          <section>
            <ActivityChart logs={filterLogsByMonth(allLogs, selectedMonth, selectedWeek)} loading={loading} />
          </section>

          <section>
            <SectionHeader>Live Analytics</SectionHeader>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-10">
              <LivePanel activeUsers={active} className="h-[450px]" loading={loading} />
              <DomainLeaderboard items={domainLeaderboard} loading={loading} className="h-[450px]" />
            </div>

            <SectionHeader>All Members</SectionHeader>
            <div className="flex flex-col gap-6">
                {/* Domain Filter Tabs - Premium */}
                <motion.div className="flex flex-wrap gap-2" initial={{ opacity: 0 }} whileInView={{ opacity: 1 }} transition={{ duration: 0.3 }}>
                  <motion.button
                    whileHover={{ scale: 1.02 }}
                    onClick={() => setSelectedDomain(null)}
                    className={`px-3 py-2 text-[10px] sm:text-xs font-black tracking-wider rounded-lg border transition-all duration-200 ${
                      selectedDomain === null
                        ? "bg-red-500/20 text-red-300 border-red-500/50 shadow-lg shadow-red-500/20"
                        : "bg-zinc-900/40 text-zinc-400 border-zinc-700/50 hover:bg-zinc-800/50 hover:text-zinc-300 hover:border-zinc-600/50"
                    }`}
                  >
                    ALL_OPERATORS
                  </motion.button>
                  {availableDomains.map(domain => (
                    <motion.button
                      key={domain}
                      whileHover={{ scale: 1.02 }}
                      onClick={() => setSelectedDomain(domain)}
                      className={`px-3 py-2 text-[10px] sm:text-xs font-black tracking-wider rounded-lg border transition-all duration-200 ${
                        selectedDomain === domain
                          ? "bg-red-500/20 text-red-300 border-red-500/50 shadow-lg shadow-red-500/20"
                          : "bg-zinc-900/40 text-zinc-400 border-zinc-700/50 hover:bg-zinc-800/50 hover:text-zinc-300 hover:border-zinc-600/50"
                      }`}
                    >
                      {domain}
                    </motion.button>
                  ))}
                </motion.div>
                
                <div className="w-full">
                  <LeaderboardTable 
                    loading={loading}
                    users={selectedDomain ? filteredUsers.filter(u => (u.Domain || "").toUpperCase() === selectedDomain) : filteredUsers}
                    onRowClick={(uid, name) => {
                      setModalUser({ uid, name });
                      setModalOpen(true);
                    }} 
                  />
                </div>
            </div>
          </section>
        </div>
      </main>

      {/* Live Toast */}
      {toastMessage && (
        <div className="fixed bottom-6 left-6 z-50 bg-black/90 border-l-4 border-red px-6 py-4 shadow-[0_0_20px_rgba(194,0,0,0.2)] animate-in slide-in-from-bottom-5 fade-in duration-300">
          <p className="text-sm font-bold text-white tracking-wide">{toastMessage}</p>
        </div>
      )}

      {/* Member Modal */}
      {modalUser && (
        <MemberModal 
          isOpen={modalOpen} 
          onClose={() => setModalOpen(false)}
          uid={modalUser.uid}
          name={modalUser.name}
          logs={allLogs}
        />
      )}

      {/* Live Modal for Mobile */}
      {liveModalOpen && (
        <LiveModal 
          isOpen={liveModalOpen}
          onClose={() => setLiveModalOpen(false)}
          activeUsers={active}
          domainLeaderboard={domainLeaderboard}
          loading={loading}
        />
      )}
      <Footer />
    </div>
  );
}

function LiveModal({
  isOpen,
  onClose,
  activeUsers,
  domainLeaderboard,
  loading,
}: {
  isOpen: boolean;
  onClose: () => void;
  activeUsers: UserStats[];
  domainLeaderboard: DomainLeaderboardEntry[];
  loading: boolean;
}) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-md p-4">
      <div className="bg-gradient-to-br from-zinc-900/90 to-zinc-950/90 backdrop-blur-2xl border border-zinc-800/60 max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col overflow-hidden shadow-[0_0_50px_rgba(239,68,68,0.1)] rounded-2xl relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500/80 via-red-500/40 to-transparent"></div>
        {/* Header */}
        <div className="px-5 py-4 border-b border-zinc-800/60 bg-zinc-900/30 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-3">
            <span className="relative flex h-2.5 w-2.5">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]"></span>
            </span>
            <span className="text-sm font-bold text-white tracking-[0.2em]">LIVE IN LAB</span>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-white hover:bg-zinc-800/50 p-1.5 rounded-full transition-all duration-200"
          >
            ✕
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 sm:p-5 no-scrollbar">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <LivePanel activeUsers={activeUsers} className="h-[320px] sm:h-[360px]" loading={loading} />
            <DomainLeaderboard items={domainLeaderboard} loading={loading} />
          </div>
        </div>
      </div>
    </div>
  );
}


function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      whileInView={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.4 }}
      className="mb-6 sm:mb-8 mt-10 sm:mt-12"
    >
      <div className="flex items-center gap-3">
        <div className="w-1 h-8 bg-gradient-to-b from-red-500 to-red-500/30 rounded-full" />
        <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{children}</h2>
      </div>
    </motion.div>
  );
}

function StatItem({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-center sm:text-left flex flex-col items-center sm:items-start">
      <p className="text-[8px] sm:text-[9px] text-zinc-500 tracking-[0.2em] font-black uppercase mb-0.5">{label}</p>
      <p className={`text-xl sm:text-2xl font-black tracking-tighter ${accent ? "text-red-500 drop-shadow-[0_0_12px_rgba(239,68,68,0.6)]" : "text-white"} font-mono`}>{value}</p>
    </div>
  );
}
