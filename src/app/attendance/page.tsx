"use client";

import { useEffect, useState, useRef } from "react";
import Image from "next/image";
import { Download } from "lucide-react";
import { TapLog, UserStats, parseCSV, parseData, calculateStats, formatDuration, getAvailableMonths, filterLogsByMonth, generateSessionCSV } from "./logic";
import { HeroCards } from "./components/HeroCards";
import { LeaderboardTable } from "./components/LeaderboardTable";
import { DomainLeaderboard, LivePanel, type DomainLeaderboardEntry } from "./components/LivePanel";
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

  // Exclude TEAM from domain ranking and domain-filter tabs.
  const availableDomains = Array.from(
    new Set(
      users
        .map(u => (u.Domain || "").trim().toUpperCase())
        .filter(domain => domain && domain !== "TEAM")
    )
  ).sort();

  const domainTotalsMap = new Map<string, { total: number; members: number }>();
  users.forEach(u => {
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
    <div className="min-h-screen flex flex-col relative z-10 overflow-x-hidden">
      {/* ── Sticky Header ── */}
      <header className="bg-black/80 backdrop-blur-md border-b border-neutral-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 sm:h-20">
            <div className="flex items-center gap-3 sm:gap-4 flex-shrink-0">
              <Image
                  src={"/textLogo.svg"}
                  alt="logo"
                  width={210}
                  height={200}
                  className="w-44 md:w-52 cursor-pointer z-50"
                  // onClick={() => router.push("/")}
                  unoptimized
                ></Image>
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

        <div className="space-y-8 sm:space-y-10">
          <section>
            <SectionHeader>Top Performers</SectionHeader>
            <HeroCards topUsers={users.slice(0, 3)} loading={loading} />
          </section>
          
          <section>
            <ActivityChart logs={filterLogsByMonth(allLogs, selectedMonth, selectedWeek)} loading={loading} />
          </section>

          <section>
            <SectionHeader>All Members</SectionHeader>

            <div className="mb-4 lg:hidden">
              <TopDomainBlocks items={domainLeaderboard} loading={loading} />
            </div>

            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-7 xl:grid-cols-[minmax(0,1fr)_460px]">
              <div>
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
                      {domain}
                    </button>
                  ))}
                </div>
                
                <LeaderboardTable 
                  loading={loading}
                  users={selectedDomain ? users.filter(u => (u.Domain || "").toUpperCase() === selectedDomain) : users}
                  onRowClick={(uid, name) => {
                    setModalUser({ uid, name });
                    setModalOpen(true);
                  }} 
                />
              </div>

              <div className="hidden lg:sticky lg:top-24 lg:flex lg:flex-col lg:gap-5">
                <LivePanel activeUsers={active} className="h-[500px]" loading={loading} />
                <DomainLeaderboard items={domainLeaderboard} compact loading={loading} />
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm">
      <div className="bg-black border border-neutral-800 max-w-2xl w-full mx-4 max-h-[85vh] flex flex-col overflow-hidden">
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

        <div className="flex-1 overflow-y-auto p-4 sm:p-5">
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
            <LivePanel activeUsers={activeUsers} className="h-[320px] sm:h-[360px]" loading={loading} />
            <DomainLeaderboard items={domainLeaderboard} loading={loading} />
          </div>
        </div>
      </div>
    </div>
  );
}

function TopDomainBlocks({ items, loading }: { items: DomainLeaderboardEntry[]; loading: boolean }) {
  if (loading) {
    return (
      <div className="attendance-skeleton-surface rounded-md border border-neutral-700 bg-[linear-gradient(180deg,rgba(18,18,18,0.98),rgba(6,6,6,0.95))] p-3 shadow-[0_14px_32px_rgba(0,0,0,0.22)]">
        <div className="mb-3 flex items-center justify-between">
          <div className="h-3 w-28 rounded-sm bg-neutral-800/90 attendance-skeleton-block" />
          <div className="h-6 w-14 rounded-md bg-neutral-800/90 attendance-skeleton-block" />
        </div>

        <div className="space-y-2.5">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={`mobile-domain-skeleton-${index}`}
              className="rounded-md border border-neutral-700 bg-black/55 px-3 py-3"
            >
              <div className="mb-1.5 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="h-3 w-8 rounded-sm bg-neutral-800/90 attendance-skeleton-block mb-2" />
                  <div className="h-4 w-20 rounded-sm bg-neutral-800/90 attendance-skeleton-block" />
                </div>
                <div className="h-4 w-14 rounded-sm bg-neutral-800/90 attendance-skeleton-block" />
              </div>
              <div className="h-3 w-16 rounded-sm bg-neutral-800/80 attendance-skeleton-block" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  const topThree = items.slice(0, 3);
  const slots = [topThree[0] || null, topThree[1] || null, topThree[2] || null];

  return (
    <div className="rounded-md border border-neutral-700 bg-[linear-gradient(180deg,rgba(18,18,18,0.98),rgba(6,6,6,0.95))] p-3 shadow-[0_14px_32px_rgba(0,0,0,0.22)]">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-[10px] font-bold tracking-[0.24em] text-neutral-400">TOP 3 DOMAINS</h3>
        <span className="rounded-md border border-neutral-700 bg-black/40 px-2 py-1 text-[10px] font-bold tracking-wider text-red">
          MOBILE
        </span>
      </div>

      <div className="space-y-2.5">
        {slots.map((item, index) => (
          <div
            key={item?.domain || `empty-domain-${index}`}
            className="rounded-md border border-neutral-700 bg-black/55 px-3 py-3"
          >
            <div className="mb-1.5 flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[10px] font-bold tracking-wider text-red">#{index + 1}</p>
                <p className="truncate text-[12px] font-bold text-white">{item?.domain || "N/A"}</p>
              </div>
              <p className="font-mono text-xs font-bold text-cyan-300">
                {item ? formatDuration(item.total) : "0h 0m"}
              </p>
            </div>
            <p className="text-[10px] font-bold tracking-wider text-neutral-500">
              {item ? `${item.members} members` : "No members"}
            </p>
          </div>
        ))}
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
