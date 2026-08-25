"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { SlidersHorizontal, Save, Play } from "lucide-react";
import { useRequireRole } from "@/hooks/use-require-role";
import { RECRUIT_SUBDOMAINS, RECRUIT_SUBDOMAIN_KEYS, subDomainLabel, type RecruitSubDomain } from "@/lib/recruit-domains";
import { GENDERS, type Gender } from "@/lib/gender";

type ExamDomain = RecruitSubDomain;

interface CutoffRow {
  sub_domain: ExamDomain;
  gender: Gender;
  cutoff_marks: number | null;
  set_by: string | null;
  set_at: string | null;
}

interface ComputeStats {
  shortlisted_count: number;
  not_shortlisted_count: number;
  pending_count: number;
}

function inputKey(domain: string, gender: string) {
  return `${domain}:${gender}`;
}

export default function RecruitmentCutoffsPage() {
  const ready = useRequireRole(["lead", "admin"]);
  const [rows, setRows] = useState<CutoffRow[]>([]);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [computing, setComputing] = useState<string | null>(null); // domain key being run, or "all"
  const [stats, setStats] = useState<ComputeStats | null>(null);
  const [skippedDomains, setSkippedDomains] = useState<string[]>([]);
  const [lastRunLabel, setLastRunLabel] = useState<string>("");

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/recruitment/cutoffs");
      const data = await res.json();
      if (res.ok && data.success) {
        setRows(data.data);
        const nextInputs: Record<string, string> = {};
        for (const row of data.data as CutoffRow[]) {
          nextInputs[inputKey(row.sub_domain, row.gender)] = row.cutoff_marks === null ? "" : String(row.cutoff_marks);
        }
        setInputs(nextInputs);
      } else {
        toast.error(data.error || "Could not load cutoffs");
      }
    } catch {
      toast.error("Could not load cutoffs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!ready) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready]);

  const saveCutoffs = async () => {
    const payload: Array<{ sub_domain: ExamDomain; gender: Gender; cutoff_marks: number }> = [];
    for (const domain of RECRUIT_SUBDOMAIN_KEYS) {
      for (const g of GENDERS) {
        const raw = inputs[inputKey(domain, g.key)] ?? "";
        if (raw.trim() === "") continue;
        const value = Number(raw);
        if (!Number.isInteger(value) || value < 0 || value > 100) {
          toast.error(`${subDomainLabel(domain)} (${g.label}) cutoff must be an integer between 0 and 100`);
          return;
        }
        payload.push({ sub_domain: domain, gender: g.key, cutoff_marks: value });
      }
    }

    if (payload.length === 0) {
      toast.error("Enter at least one cutoff value");
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/admin/recruitment/cutoffs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Cutoffs saved");
        load();
      } else {
        toast.error(data.error || "Could not save cutoffs");
      }
    } catch {
      toast.error("Could not save cutoffs");
    } finally {
      setSaving(false);
    }
  };

  // domain === null runs every domain in one request (the original global button);
  // otherwise scopes the run to just that domain — a domain still needs BOTH male and
  // female cutoffs set or the server skips it regardless of scope.
  const runShortlist = async (domain: string | null) => {
    setComputing(domain ?? "all");
    setStats(null);
    setSkippedDomains([]);
    try {
      const res = await fetch("/api/admin/recruitment/shortlist/compute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(domain ? { sub_domain: domain } : {}),
      });
      const data = await res.json();
      if (res.ok && data.computed) {
        setStats(data.stats);
        setSkippedDomains(data.skipped_domains || []);
        setLastRunLabel(domain ? subDomainLabel(domain) : "All domains");
        toast.success(domain ? `Shortlist engine ran for ${subDomainLabel(domain)}` : "Shortlist engine ran for all domains");
      } else {
        toast.error(data.error || "Could not run shortlist engine");
      }
    } catch {
      toast.error("Could not run shortlist engine");
    } finally {
      setComputing(null);
    }
  };

  if (!ready) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
          <SlidersHorizontal className="w-7 h-7 text-red" />
          Cutoffs &amp; Shortlist Engine
        </h1>
        <p className="mt-2 text-gray-400 text-sm max-w-xl">
          Set a male and female pass mark per domain, then run the shortlist engine to
          auto-compute status for every recruit who selected that domain. A domain is
          skipped until both genders&apos; cutoffs are set.
        </p>
      </div>

      <div className="border border-white/10 bg-black">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading...</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-white/10">
                  <th className="px-5 py-3">Domain</th>
                  <th className="px-5 py-3">Male Cutoff</th>
                  <th className="px-5 py-3">Female Cutoff</th>
                  <th className="px-5 py-3">Last Set</th>
                  <th className="px-5 py-3 text-right">Run</th>
                </tr>
              </thead>
              <tbody>
                {RECRUIT_SUBDOMAINS.map((d) => {
                  const domain = d.key;
                  const domainRows = rows.filter((r) => r.sub_domain === domain);
                  const rowFor = (gender: Gender) => domainRows.find((r) => r.gender === gender);
                  const bothSet = GENDERS.every((g) => (inputs[inputKey(domain, g.key)] ?? "").trim() !== "");
                  return (
                    <tr key={domain} className="border-b border-white/5 last:border-0">
                      <td className="px-5 py-3 text-white font-medium">
                        {d.label} <span className="text-xs font-normal text-gray-500">{d.subsystem}</span>
                      </td>
                      {GENDERS.map((g) => (
                        <td key={g.key} className="px-5 py-3">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={inputs[inputKey(domain, g.key)] ?? ""}
                            onChange={(e) =>
                              setInputs((prev) => ({ ...prev, [inputKey(domain, g.key)]: e.target.value }))
                            }
                            placeholder="Not set"
                            className="w-24 border-0 bg-white/5 py-1.5 px-3 text-white text-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500"
                          />
                        </td>
                      ))}
                      <td className="px-5 py-3 text-gray-500 text-xs">
                        {GENDERS.map((g) => {
                          const row = rowFor(g.key);
                          return (
                            <div key={g.key}>
                              {g.label}:{" "}
                              {row?.set_by && row?.set_at
                                ? `${row.set_by} · ${new Date(row.set_at).toLocaleString()}`
                                : "Never set"}
                            </div>
                          );
                        })}
                      </td>
                      <td className="px-5 py-3 text-right">
                        <button
                          onClick={() => runShortlist(domain)}
                          disabled={computing !== null || !bothSet}
                          title={bothSet ? `Run shortlist for ${d.label}` : "Both cutoffs must be set first"}
                          className="inline-flex items-center gap-1.5 bg-red/15 text-white ring-1 ring-inset ring-red/40 px-3 py-1.5 text-xs font-semibold hover:bg-red/25 disabled:opacity-40 transition"
                        >
                          <Play className="w-3.5 h-3.5" /> {computing === domain ? "Running..." : "Run"}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex flex-wrap gap-3">
        <button
          onClick={saveCutoffs}
          disabled={saving}
          className="group relative overflow-hidden inline-flex items-center bg-red text-white px-8 py-2.5 text-sm font-semibold shadow-lg shadow-red/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-red/40 active:translate-y-0 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none"
          style={{ clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)" }}
        >
          <span
            className="absolute inset-0 -translate-x-full transition-transform duration-200 ease-out group-hover:translate-x-0"
            style={{
              clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)",
              backgroundColor: "#D4AF37",
            }}
          />
          <span className="relative inline-flex items-center gap-2 transition-colors duration-200 group-hover:text-black">
            <Save className="w-4 h-4" /> {saving ? "Saving..." : "Save Cutoffs"}
          </span>
        </button>
        <button
          onClick={() => runShortlist(null)}
          disabled={computing !== null}
          className="group relative overflow-hidden inline-flex items-center bg-red text-white px-8 py-2.5 text-sm font-semibold shadow-lg shadow-red/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-red/40 active:translate-y-0 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none"
          style={{ clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)" }}
        >
          <span
            className="absolute inset-0 -translate-x-full transition-transform duration-200 ease-out group-hover:translate-x-0"
            style={{
              clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)",
              backgroundColor: "#D4AF37",
            }}
          />
          <span className="relative inline-flex items-center gap-2 transition-colors duration-200 group-hover:text-black">
            <Play className="w-4 h-4" /> {computing === "all" ? "Running..." : "Run Shortlist (All Domains)"}
          </span>
        </button>
      </div>

      {stats && (
        <div className="border border-white/10 bg-black p-6">
          <h2 className="text-sm font-bold uppercase tracking-widest text-gray-400 mb-4">
            Shortlist Engine Results: {lastRunLabel}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-emerald-500/10 ring-1 ring-inset ring-emerald-500/30 p-4">
              <p className="text-2xl font-black text-emerald-400">{stats.shortlisted_count}</p>
              <p className="text-xs text-gray-400 mt-1">Shortlisted</p>
            </div>
            <div className="bg-red-500/10 ring-1 ring-inset ring-red-500/30 p-4">
              <p className="text-2xl font-black text-red-400">{stats.not_shortlisted_count}</p>
              <p className="text-xs text-gray-400 mt-1">Not Shortlisted</p>
            </div>
            <div className="bg-amber-500/10 ring-1 ring-inset ring-amber-500/30 p-4">
              <p className="text-2xl font-black text-amber-400">{stats.pending_count}</p>
              <p className="text-xs text-gray-400 mt-1">Pending (no marks/gender yet)</p>
            </div>
          </div>
          {skippedDomains.length > 0 && (
            <p className="mt-4 text-xs text-amber-400">
              Skipped (male + female cutoff not both set): {skippedDomains.map((d) => subDomainLabel(d)).join(", ")}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
