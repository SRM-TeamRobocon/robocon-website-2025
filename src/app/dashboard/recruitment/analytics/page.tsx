"use client";

import { useEffect, useState } from "react";
import { BarChart3, AlertTriangle } from "lucide-react";
import {
    ResponsiveContainer,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    Cell,
    type TooltipContentProps,
} from "recharts";
import { useRequireRole } from "@/hooks/use-require-role";

import { subDomainLabel, subDomainSubsystem, RECRUIT_SUBDOMAIN_KEYS } from "@/lib/recruit-domains";

// Only registration is live for this cycle — orientation/exam/shortlist/interview/training
// haven't started, so those sections are commented out below (not deleted) rather than
// removed. Re-enable them once those stages have real data; the API already computes all
// of it (src/app/api/admin/recruitment/analytics/route.ts), so nothing there needs to change.

interface OutcomeCounts {
    selected: number;
    rejected: number;
    waitlisted: number;
}

interface FunnelCounts {
    registered: number;
    orientation: number;
    exam_attended: number;
    shortlisted: number;
    interviewed: number;
    selected: number;
    interview_outcomes: OutcomeCounts;
}

interface DomainStats extends FunnelCounts {
    sub_domain: string;
}

interface DomainGenderStats {
    sub_domain: string;
    male: number;
    female: number;
    unspecified: number;
}

interface DomainHostellerStats {
    sub_domain: string;
    hosteller: number;
    day_scholar: number;
}

interface SessionStat {
    id: string;
    session_date: string;
    session_label: string;
    present_count: number;
    attendance_pct: number | null;
    has_occurred: boolean;
}

interface AnalyticsData {
    cycle: { id: string; name: string; year: string };
    overall: FunnelCounts;
    by_domain: DomainStats[];
    by_domain_gender: DomainGenderStats[];
    by_domain_hosteller: DomainHostellerStats[];
    training: {
        total_trainees: number;
        sessions: SessionStat[];
        held_sessions: number;
        total_sessions_created: number;
        average_attendance_pct: number;
    };
}

// Validated dark-mode categorical palette (colorblind-safe adjacent ordering) — see the
// dataviz skill's reference palette. Domains are mapped to slots in a fixed order (never by
// rank/sort position) so a bar's color always identifies the same domain everywhere on the
// page.
const CATEGORICAL_DARK = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"];
const DOMAIN_COLOR: Record<string, string> = Object.fromEntries(
    RECRUIT_SUBDOMAIN_KEYS.map((key, i) => [key, CATEGORICAL_DARK[i % CATEGORICAL_DARK.length]])
);
const GENDER_COLOR = { male: "#3987e5", female: "#d95886", unspecified: "#6b6b68" };
const RESIDENCE_COLOR = { hosteller: "#3987e5", day_scholar: "#199e70" };

function ChartTooltip({ active, payload, label }: TooltipContentProps) {
    if (!active || !payload || !payload.length) return null;
    return (
        <div className="border border-white/10 bg-black/90 px-3 py-2 text-xs backdrop-blur-xl">
            {label && <p className="text-gray-400 font-semibold mb-1">{label}</p>}
            {payload.map((p) => (
                <p key={p.dataKey as string} className="font-bold" style={{ color: p.color }}>
                    {p.name}: <span className="text-white">{p.value}</span>
                </p>
            ))}
        </div>
    );
}

const axisTick = { fill: "#9ca3af", fontSize: 11 };
const legendStyle = { fontSize: 11, color: "#9ca3af" };

function FunnelBar({
    label,
    value,
    max,
}: {
    label: string;
    value: number;
    max: number;
}) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
        <div>
            <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-400 font-semibold">{label}</span>
                <span className="text-white font-bold">
                    {value} <span className="text-gray-500 font-normal">({pct}% of registered)</span>
                </span>
            </div>
            <div className="h-2 bg-white/5 overflow-hidden">
                <div className="h-full bg-red transition-all" style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

export default function RecruitmentAnalyticsPage() {
    const ready = useRequireRole(["member", "lead", "admin"]);
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!ready) return;
        fetch("/api/admin/recruitment/analytics")
            .then((res) => res.json())
            .then((d) => {
                if (d.success) setData(d);
                else setError(d.error || "Could not load analytics");
            })
            .catch(() => setError("Could not load analytics"))
            .finally(() => setLoading(false));
    }, [ready]);

    if (!ready) return null;

    const domainChartData = data
        ? [...data.by_domain]
              .sort((a, b) => b.registered - a.registered)
              .map((row) => ({
                  sub_domain: row.sub_domain,
                  name: subDomainLabel(row.sub_domain),
                  Registered: row.registered,
              }))
        : [];

    const genderChartData = data
        ? data.by_domain_gender.map((row) => ({
              name: subDomainLabel(row.sub_domain),
              Male: row.male,
              Female: row.female,
              Unspecified: row.unspecified,
          }))
        : [];

    const residenceChartData = data
        ? data.by_domain_hosteller.map((row) => ({
              name: subDomainLabel(row.sub_domain),
              Hosteller: row.hosteller,
              "Day Scholar": row.day_scholar,
          }))
        : [];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                    <BarChart3 className="w-7 h-7 text-red" />
                    Recruitment Analytics
                </h1>
                <p className="mt-2 text-gray-400 text-sm max-w-xl">
                    Registration metrics for the active recruitment cycle. Orientation, exam, interview and
                    training stages aren&apos;t live yet.
                </p>
            </div>

            {loading ? (
                <div
                    className="border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8 text-center text-gray-500 text-sm"
                    style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
                >
                    Loading...
                </div>
            ) : error || !data ? (
                <div
                    className="border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8 text-center text-gray-500 text-sm flex flex-col items-center gap-2"
                    style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
                >
                    <AlertTriangle className="w-6 h-6 text-amber-400" />
                    {error || "No data available."}
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div
                            className="border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6"
                            style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
                        >
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Active Cycle</p>
                            <p className="text-xl font-bold text-white">
                                {data.cycle.name} <span className="text-gray-500 font-normal">({data.cycle.year})</span>
                            </p>
                        </div>
                        <div
                            className="border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6"
                            style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
                        >
                            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Total Registered</p>
                            <p className="text-2xl font-black text-white">{data.overall.registered}</p>
                        </div>
                    </div>

                    {/* Overall Funnel — commented out, only "registered" is meaningful right now.
                    <div
                        className="border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 space-y-4"
                        style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
                    >
                        <h2 className="text-lg font-bold text-white">Overall Funnel</h2>
                        <div className="space-y-3">
                            {FUNNEL_STAGES.map((stage, i) => (
                                <FunnelBar
                                    key={stage.key}
                                    label={stage.label}
                                    value={data.overall[stage.key] as number}
                                    max={data.overall.registered}
                                    prevValue={i > 0 ? (data.overall[FUNNEL_STAGES[i - 1].key] as number) : undefined}
                                    prevLabel={i > 0 ? FUNNEL_STAGES[i - 1].label : undefined}
                                />
                            ))}
                        </div>
                    </div>
                    */}

                    {/* Interview Outcomes — commented out, no interviews yet.
                    <div
                        className="border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 space-y-4"
                        style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
                    >
                        <h2 className="text-lg font-bold text-white">Interview Outcomes</h2>
                        <div className="grid grid-cols-3 gap-3">
                            <OutcomeTile label="Selected" value={data.overall.interview_outcomes.selected} total={data.overall.interviewed} color="#34d399" />
                            <OutcomeTile label="Waitlisted" value={data.overall.interview_outcomes.waitlisted} total={data.overall.interviewed} color="#fbbf24" />
                            <OutcomeTile label="Rejected" value={data.overall.interview_outcomes.rejected} total={data.overall.interviewed} color="#f87171" />
                        </div>
                    </div>
                    */}

                    {/* Breakdown by Sub-Domain (full funnel) — commented out, only registration
                        columns are meaningful right now; see the registration/gender/residence
                        charts below instead.
                    <div
                        className="border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden"
                        style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
                    >
                        <div className="p-5 pb-0">
                            <h2 className="text-lg font-bold text-white">Breakdown by Sub-Domain</h2>
                        </div>
                        <div className="overflow-x-auto mt-4">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-white/10">
                                        <th className="px-5 py-3">Domain</th>
                                        <th className="px-5 py-3">Registered</th>
                                        <th className="px-5 py-3">Orientation</th>
                                        <th className="px-5 py-3">Exam</th>
                                        <th className="px-5 py-3">Shortlisted</th>
                                        <th className="px-5 py-3">Interviewed</th>
                                        <th className="px-5 py-3">Selected</th>
                                        <th className="px-5 py-3">Waitlisted</th>
                                        <th className="px-5 py-3">Rejected</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.by_domain.map((row) => (
                                        <tr key={row.sub_domain} className="border-b border-white/5 last:border-0">
                                            <td className="px-5 py-3 text-white font-medium">
                                                {subDomainLabel(row.sub_domain)}
                                                <span className="ml-1.5 text-xs font-normal text-gray-500">{subDomainSubsystem(row.sub_domain)}</span>
                                            </td>
                                            <td className="px-5 py-3 text-gray-300">{row.registered}</td>
                                            <td className="px-5 py-3 text-gray-300">{row.orientation}</td>
                                            <td className="px-5 py-3 text-gray-300">{row.exam_attended}</td>
                                            <td className="px-5 py-3 text-gray-300">{row.shortlisted}</td>
                                            <td className="px-5 py-3 text-gray-300">{row.interviewed}</td>
                                            <td className="px-5 py-3 text-gray-300">{row.selected}</td>
                                            <td className="px-5 py-3 text-gray-300">{row.interview_outcomes.waitlisted}</td>
                                            <td className="px-5 py-3 text-gray-300">{row.interview_outcomes.rejected}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                    */}

                    <div
                        className="border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 space-y-4"
                        style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
                    >
                        <h2 className="text-lg font-bold text-white">Registration Share by Domain</h2>
                        <div style={{ width: "100%", height: 280 }}>
                            <ResponsiveContainer>
                                <BarChart data={domainChartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                                    <XAxis dataKey="name" tick={axisTick} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} tickLine={false} />
                                    <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                                    <Tooltip content={ChartTooltip} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                                    <Bar dataKey="Registered" radius={[4, 4, 0, 0]} maxBarSize={56}>
                                        {domainChartData.map((row) => (
                                            <Cell key={row.sub_domain} fill={DOMAIN_COLOR[row.sub_domain]} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="space-y-3 pt-2">
                            {domainChartData.map((row) => (
                                <FunnelBar
                                    key={row.sub_domain}
                                    label={`${row.name} (${subDomainSubsystem(row.sub_domain)})`}
                                    value={row.Registered}
                                    max={data.overall.registered}
                                />
                            ))}
                        </div>
                    </div>

                    {/* Selection Yield by Domain — commented out, no selections yet.
                    <div
                        className="border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 space-y-4"
                        style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
                    >
                        <h2 className="text-lg font-bold text-white">Selection Yield by Domain</h2>
                        <p className="text-xs text-gray-500 -mt-2">Share of each domain&apos;s registrants who were ultimately selected.</p>
                        <div className="space-y-3">
                            {[...data.by_domain]
                                .sort((a, b) => (b.registered > 0 ? b.selected / b.registered : 0) - (a.registered > 0 ? a.selected / a.registered : 0))
                                .map((row) => (
                                    <FunnelBar key={row.sub_domain} label={`${subDomainLabel(row.sub_domain)} (${subDomainSubsystem(row.sub_domain)})`} value={row.selected} max={row.registered} />
                                ))}
                        </div>
                    </div>
                    */}

                    <div
                        className="border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden"
                        style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
                    >
                        <div className="p-5 pb-0">
                            <h2 className="text-lg font-bold text-white">Registrations by Gender, per Domain</h2>
                            <p className="mt-1 text-xs text-gray-500">Registered recruits only. &quot;Unspecified&quot; covers accounts predating the gender field.</p>
                        </div>
                        <div className="px-5 pt-4" style={{ width: "100%", height: 280 }}>
                            <ResponsiveContainer>
                                <BarChart data={genderChartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                                    <XAxis dataKey="name" tick={axisTick} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} tickLine={false} />
                                    <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                                    <Tooltip content={ChartTooltip} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                                    <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={8} />
                                    <Bar dataKey="Male" fill={GENDER_COLOR.male} radius={[4, 4, 0, 0]} maxBarSize={28} />
                                    <Bar dataKey="Female" fill={GENDER_COLOR.female} radius={[4, 4, 0, 0]} maxBarSize={28} />
                                    <Bar dataKey="Unspecified" fill={GENDER_COLOR.unspecified} radius={[4, 4, 0, 0]} maxBarSize={28} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="overflow-x-auto mt-4">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-white/10">
                                        <th className="px-5 py-3">Domain</th>
                                        <th className="px-5 py-3">Male</th>
                                        <th className="px-5 py-3">Female</th>
                                        <th className="px-5 py-3">Unspecified</th>
                                        <th className="px-5 py-3">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.by_domain_gender.map((row) => (
                                        <tr key={row.sub_domain} className="border-b border-white/5 last:border-0">
                                            <td className="px-5 py-3 text-white font-medium">
                                                {subDomainLabel(row.sub_domain)}
                                                <span className="ml-1.5 text-xs font-normal text-gray-500">
                                                    {subDomainSubsystem(row.sub_domain)}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-gray-300">{row.male}</td>
                                            <td className="px-5 py-3 text-gray-300">{row.female}</td>
                                            <td className="px-5 py-3 text-gray-300">{row.unspecified}</td>
                                            <td className="px-5 py-3 text-gray-300">{row.male + row.female + row.unspecified}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div
                        className="border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden"
                        style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
                    >
                        <div className="p-5 pb-0">
                            <h2 className="text-lg font-bold text-white">Registrations by Residence, per Domain</h2>
                            <p className="mt-1 text-xs text-gray-500">Registered recruits only — hosteller vs day scholar.</p>
                        </div>
                        <div className="px-5 pt-4" style={{ width: "100%", height: 280 }}>
                            <ResponsiveContainer>
                                <BarChart data={residenceChartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                                    <XAxis dataKey="name" tick={axisTick} axisLine={{ stroke: "rgba(255,255,255,0.1)" }} tickLine={false} />
                                    <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                                    <Tooltip content={ChartTooltip} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                                    <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={8} />
                                    <Bar dataKey="Hosteller" fill={RESIDENCE_COLOR.hosteller} radius={[4, 4, 0, 0]} maxBarSize={40} />
                                    <Bar dataKey="Day Scholar" fill={RESIDENCE_COLOR.day_scholar} radius={[4, 4, 0, 0]} maxBarSize={40} />
                                </BarChart>
                            </ResponsiveContainer>
                        </div>
                        <div className="overflow-x-auto mt-4">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-white/10">
                                        <th className="px-5 py-3">Domain</th>
                                        <th className="px-5 py-3">Hosteller</th>
                                        <th className="px-5 py-3">Day Scholar</th>
                                        <th className="px-5 py-3">Total</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {data.by_domain_hosteller.map((row) => (
                                        <tr key={row.sub_domain} className="border-b border-white/5 last:border-0">
                                            <td className="px-5 py-3 text-white font-medium">
                                                {subDomainLabel(row.sub_domain)}
                                                <span className="ml-1.5 text-xs font-normal text-gray-500">
                                                    {subDomainSubsystem(row.sub_domain)}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-gray-300">{row.hosteller}</td>
                                            <td className="px-5 py-3 text-gray-300">{row.day_scholar}</td>
                                            <td className="px-5 py-3 text-gray-300">{row.hosteller + row.day_scholar}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {/* Training Attendance — commented out, training hasn't started.
                    <div
                        className="border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden"
                        style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
                    >
                        <div className="p-5 pb-0">
                            <h2 className="text-lg font-bold text-white">Training Attendance</h2>
                            <p className="mt-1 text-xs text-gray-500">
                                {data.training.held_sessions} of {data.training.total_sessions_created} session
                                {data.training.total_sessions_created === 1 ? "" : "s"} held · average{" "}
                                {data.training.average_attendance_pct}% across held sessions. Scheduled sessions are
                                excluded from the average.
                            </p>
                        </div>
                        {data.training.sessions.length === 0 ? (
                            <div className="p-8 text-center text-gray-500 text-sm">No training sessions yet.</div>
                        ) : (
                            <div className="overflow-x-auto mt-4">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="text-left text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-white/10">
                                            <th className="px-5 py-3">Session</th>
                                            <th className="px-5 py-3">Date</th>
                                            <th className="px-5 py-3">Present</th>
                                            <th className="px-5 py-3">Attendance %</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {data.training.sessions.map((s) => (
                                            <tr key={s.id} className="border-b border-white/5 last:border-0">
                                                <td className="px-5 py-3 text-white font-medium">
                                                    {s.session_label}
                                                    {!s.has_occurred && (
                                                        <span className="ml-2 inline-flex items-center bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 ring-1 ring-inset ring-white/10">
                                                            Scheduled
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3 text-gray-300">{new Date(s.session_date).toLocaleDateString()}</td>
                                                <td className="px-5 py-3 text-gray-300">
                                                    {s.has_occurred ? `${s.present_count} / ${data.training.total_trainees}` : <span className="text-gray-600">—</span>}
                                                </td>
                                                <td className="px-5 py-3 text-gray-300">
                                                    {s.attendance_pct === null ? <span className="text-gray-600">—</span> : `${s.attendance_pct}%`}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                    */}
                </>
            )}
        </div>
    );
}
