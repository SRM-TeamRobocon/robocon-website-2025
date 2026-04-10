"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { Download } from "lucide-react";
import { TapLog, UserStats, parseCSV, parseData, calculateStats, formatDuration, getAvailableMonths, filterLogsByMonth, generateSessionCSV } from "./logic";
import { HeroCards } from "./components/HeroCards";
import { LeaderboardTable } from "./components/LeaderboardTable";
import { LivePanel } from "./components/LivePanel";
import { ActivityChart } from "./components/ActivityChart";
import { MemberModal } from "./components/MemberModal";

export default function AttendanceDashboard() {
  const [allLogs, setAllLogs] = useState<TapLog[]>([]);
  const [users, setUsers] = useState<UserStats[]>([]);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Filters
  const [selectedMonth, setSelectedMonth] = useState<string | null>(null);
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

  const recalculate = (logs: TapLog[], monthKey: string | null, weekKey: number | null) => {
    const filtered = filterLogsByMonth(logs, monthKey, weekKey);
    const stats = calculateStats(filtered, Date.now());
    stats.sort((a, b) => b.overallTotalTimeMs - a.overallTotalTimeMs);
    setUsers(stats);

    // Check for new live entries
    const currentActive = new Set(stats.filter(u => u.status === "IN").map(u => u.UID));
    if (prevActiveRef.current.size > 0 && currentActive.size > prevActiveRef.current.size) {
      for (const uid of Array.from(currentActive)) {
        if (!prevActiveRef.current.has(uid)) {
          const user = stats.find(u => u.UID === uid);
          if (user) {
            setToastMessage(`🤖 ${user.Name} has entered the lab.`);
            setTimeout(() => setToastMessage(null), 5000);
          }
        }
      }
    }
    prevActiveRef.current = currentActive;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/attendance?t=${Date.now()}`);
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const text = await res.text();
      
      let logs: TapLog[];
      try {
        logs = parseData(JSON.parse(text));
      } catch {
        logs = parseCSV(text);
      }
      if (logs.length === 0) throw new Error("No valid rows found in sheet");

      setAllLogs(logs);
      recalculate(logs, selectedMonth, selectedWeek);
      setError(null);
    } catch (err: any) {
      console.error("Fetch failed:", err.message);
      setError(err.message);
    } finally {
      setLastRefresh(new Date());
      setLoading(false);
    }
  };

  // Reset week when month changes
  useEffect(() => {
    setSelectedWeek(null);
  }, [selectedMonth]);

  useEffect(() => {
    if (allLogs.length > 0) {
      recalculate(allLogs, selectedMonth, selectedWeek);
    }
  }, [selectedMonth, selectedWeek]);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 60_000);
    return () => clearInterval(iv);
  }, []);

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

  const active = users.filter(u => u.status === "IN");
  const totalMs = users.reduce((s, u) => s + u.overallTotalTimeMs, 0);
  const availableMonths = getAvailableMonths(allLogs);
  const availableDomains = Array.from(new Set(users.map(u => u.Domain).filter(Boolean))).sort();

  return (
    <div className="min-h-screen flex flex-col relative z-10 overflow-x-hidden">
      {/* ── Sticky Header ── */}
      <header className="bg-black/80 backdrop-blur-md border-b border-neutral-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
              <Image src="/textLogo.svg" alt="Logo" height={80} width={80} unoptimized className="sw-15 h-15" />
              {/* <div>
                <h1 className="text-white font-bold text-sm sm:text-lg leading-tight">
                  SRM <span className="text-red">TEAM</span>
                </h1>
                <h1 className="text-white font-bold text-sm sm:text-lg leading-tight -mt-0.5">ROBOCON</h1>
              </div> */}
            </div>

            <div className="hidden sm:flex items-center gap-6 lg:gap-8">
              <StatItem label="In Lab" value={active.length.toString()} accent />
              <StatItem label="Total Hours" value={formatDuration(totalMs)} />
              <StatItem label="Members" value={users.length.toString()} />
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <span className="text-[9px] text-neutral-600 hidden md:block">
                {lastRefresh.toLocaleTimeString()}
              </span>
              
              {/* Mobile Live Button */}
              <button
                onClick={() => setLiveModalOpen(true)}
                className="lg:hidden h-9 px-3 bg-red/10 border border-red/30 text-red text-[10px] sm:text-xs font-bold tracking-wider hover:bg-red/20 transition-all"
              >
                LIVE ({active.length})
              </button>
              
              <button
                onClick={fetchData}
                disabled={loading}
                className="h-9 px-3 sm:px-5 bg-red/10 border border-red/30 text-red text-[10px] sm:text-xs font-bold tracking-wider hover:bg-red/20 transition-all disabled:opacity-40 active:scale-95"
              >
                {loading ? "SYNCING" : "SYNC"}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Content ── */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 sm:py-10">
        {error && (
          <div className="mb-6 px-4 py-3 bg-red/5 border-l-4 border-red">
            <p className="text-xs text-red font-bold tracking-wider">CONNECTION ERROR</p>
            <p className="text-[11px] text-neutral-400 mt-0.5">{error}</p>
          </div>
        )}

        {/* ── Filter & Export Controls ── */}
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSelectedMonth(null)}
              className={`px-3 sm:px-4 py-2 text-[10px] sm:text-xs font-bold tracking-wider border transition-all ${
                selectedMonth === null
                  ? "bg-red text-white border-red"
                  : "bg-transparent text-neutral-400 border-neutral-800 hover:border-neutral-600 hover:text-white"
              }`}
            >
              ALL TIME
            </button>
            {availableMonths.map(m => (
              <button
                key={m.key}
                onClick={() => setSelectedMonth(m.key)}
                className={`px-3 sm:px-4 py-2 text-[10px] sm:text-xs font-bold tracking-wider border transition-all ${
                  selectedMonth === m.key
                    ? "bg-red text-white border-red"
                    : "bg-transparent text-neutral-400 border-neutral-800 hover:border-neutral-600 hover:text-white"
                }`}
              >
                {m.label.toUpperCase()}
              </button>
            ))}

            {selectedMonth && (
               <select 
                 value={selectedWeek || ""} 
                 onChange={e => setSelectedWeek(e.target.value ? Number(e.target.value) : null)}
                 className="bg-black text-neutral-300 border border-neutral-800 hover:border-neutral-600 px-3 py-2 text-[10px] sm:text-xs font-bold tracking-wider focus:outline-none transition-colors ml-0 sm:ml-2"
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

          <button 
             onClick={handleDownload}
             className="flex items-center justify-center gap-2 px-4 py-2 border border-blue-500/30 bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 transition-colors text-[10px] sm:text-xs font-bold tracking-widest shrink-0"
          >
             <Download size={14} /> EXPORT CSV
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
          <div className="lg:col-span-3 space-y-8 sm:space-y-10 order-2 lg:order-1">
            <section>
              <SectionHeader>Top Performers</SectionHeader>
              <HeroCards topUsers={users.slice(0, 3)} />
            </section>
            
            <section>
              <ActivityChart logs={filterLogsByMonth(allLogs, selectedMonth, selectedWeek)} />
            </section>

            <section>
              <SectionHeader>All Members</SectionHeader>
              
              {/* Domain Tabs */}
              <div className="mb-4 flex flex-wrap gap-2">
                <button
                  onClick={() => setSelectedDomain(null)}
                  className={`px-3 py-2 text-[10px] sm:text-xs font-bold tracking-wider border transition-all ${
                    selectedDomain === null
                      ? "bg-red text-white border-red"
                      : "bg-transparent text-neutral-400 border-neutral-800 hover:border-neutral-600 hover:text-white"
                  }`}
                >
                  ALL DOMAINS
                </button>
                {availableDomains.map(domain => (
                  <button
                    key={domain}
                    onClick={() => setSelectedDomain(domain)}
                    className={`px-3 py-2 text-[10px] sm:text-xs font-bold tracking-wider border transition-all ${
                      selectedDomain === domain
                        ? "bg-red text-white border-red"
                        : "bg-transparent text-neutral-400 border-neutral-800 hover:border-neutral-600 hover:text-white"
                    }`}
                  >
                    {domain.toUpperCase()}
                  </button>
                ))}
              </div>
              
              <LeaderboardTable 
                users={selectedDomain ? users.filter(u => u.Domain === selectedDomain) : users} 
                onRowClick={(uid, name) => {
                  setModalUser({ uid, name });
                  setModalOpen(true);
                }} 
              />
            </section>
          </div>

          <div className="lg:col-span-1 order-1 lg:order-2 hidden lg:block">
            <div className="sticky top-24 h-[calc(100vh-120px)]">
              <LivePanel activeUsers={active} />
            </div>
          </div>
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
        />
      )}
    </div>
  );
}

function LiveModal({ isOpen, onClose, activeUsers }: { isOpen: boolean; onClose: () => void; activeUsers: UserStats[] }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-black border border-neutral-800 max-w-md w-full mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 border-b border-neutral-800 bg-neutral-900/80 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-red animate-pulse" />
            <span className="text-sm font-bold text-white tracking-widest">LIVE IN LAB</span>
          </div>
          <button
            onClick={onClose}
            className="text-neutral-500 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {activeUsers.length === 0 ? (
            <div className="text-center py-8">
              <div className="w-4 h-4 bg-neutral-800 mx-auto mb-3 rounded-full" />
              <p className="text-sm text-neutral-500 font-bold tracking-widest">NO ONE IN LAB</p>
            </div>
          ) : (
            activeUsers.map((user) => {
              const liveDur = Math.max(0, Date.now() - user.lastTapMs);
              return (
                <div key={user.UID} className="flex items-center justify-between px-4 py-3 bg-neutral-950 border-l-2 border-red">
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-white truncate">{user.Name}</p>
                    <p className="text-[10px] text-neutral-600 font-mono mt-0.5">
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
    </div>
  );
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="border-l-4 border-red pl-3 mb-4 sm:mb-6 mt-8">
      <h2 className="text-xl sm:text-2xl font-bold text-white">{children}</h2>
    </div>
  );
}

function StatItem({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="text-center sm:text-left">
      <p className="text-[9px] sm:text-[10px] text-neutral-500 tracking-wider font-bold uppercase">{label}</p>
      <p className={`text-lg sm:text-xl font-bold ${accent ? "text-red" : "text-white"}`}>{value}</p>
    </div>
  );
}
