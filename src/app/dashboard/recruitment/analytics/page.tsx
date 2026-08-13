"use client";

import { useEffect, useState } from "react";
import { BarChart3, AlertTriangle } from "lucide-react";
import { useRequireRole } from "@/hooks/use-require-role";

import { subDomainLabel, subDomainSubsystem } from "@/lib/recruit-domains";

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

const FUNNEL_STAGES: { key: keyof FunnelCounts; label: string }[] = [
    { key: "registered", label: "Registered" },
    { key: "orientation", label: "Orientation" },
    { key: "exam_attended", label: "Exam" },
    { key: "shortlisted", label: "Shortlisted" },
    { key: "interviewed", label: "Interviewed" },
    { key: "selected", label: "Selected" },
];

interface DomainStats extends FunnelCounts {
    sub_domain: string;
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
    training: {
        total_trainees: number;
        sessions: SessionStat[];
        held_sessions: number;
        total_sessions_created: number;
        average_attendance_pct: number;
    };
}

function FunnelBar({
    label,
    value,
    max,
    prevValue,
    prevLabel,
}: {
    label: string;
    value: number;
    max: number;
    prevValue?: number;
    prevLabel?: string;
}) {
    const pct = max > 0 ? Math.round((value / max) * 100) : 0;
    const stepPct = prevValue !== undefined && prevValue > 0 ? Math.round((value / prevValue) * 100) : null;
    return (
        <div>
            <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-400 font-semibold">{label}</span>
                <span className="text-white font-bold">
                    {value}{" "}
                    <span className="text-gray-500 font-normal">
                        ({pct}% of registered
                        {stepPct !== null ? ` · ${stepPct}% of ${prevLabel}` : ""})
                    </span>
                </span>
            </div>
            <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <div className="h-full rounded-full bg-red transition-all" style={{ width: `${pct}%` }} />
            </div>
        </div>
    );
}

function OutcomeTile({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
    return (
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">{label}</p>
            <p className="text-2xl font-black text-white">{value}</p>
            <p className="text-xs mt-0.5" style={{ color }}>
                {pct}% of interviewed
            </p>
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

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                    <BarChart3 className="w-7 h-7 text-red" />
                    Recruitment Analytics
                </h1>
                <p className="mt-2 text-gray-400 text-sm max-w-xl">
                    Funnel metrics for the active recruitment cycle.
                </p>
            </div>

            {loading ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8 text-center text-gray-500 text-sm">
                    Loading...
                </div>
            ) : error || !data ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8 text-center text-gray-500 text-sm flex flex-col items-center gap-2">
                    <AlertTriangle className="w-6 h-6 text-amber-400" />
                    {error || "No data available."}
                </div>
            ) : (
                <>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6">
                        <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">Active Cycle</p>
                        <p className="text-xl font-bold text-white">
                            {data.cycle.name} <span className="text-gray-500 font-normal">({data.cycle.year})</span>
                        </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 space-y-4">
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

                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 space-y-4">
                        <h2 className="text-lg font-bold text-white">Interview Outcomes</h2>
                        <div className="grid grid-cols-3 gap-3">
                            <OutcomeTile
                                label="Selected"
                                value={data.overall.interview_outcomes.selected}
                                total={data.overall.interviewed}
                                color="#34d399"
                            />
                            <OutcomeTile
                                label="Waitlisted"
                                value={data.overall.interview_outcomes.waitlisted}
                                total={data.overall.interviewed}
                                color="#fbbf24"
                            />
                            <OutcomeTile
                                label="Rejected"
                                value={data.overall.interview_outcomes.rejected}
                                total={data.overall.interviewed}
                                color="#f87171"
                            />
                        </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden">
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
                                                <span className="ml-1.5 text-xs font-normal text-gray-500">
                                                    {subDomainSubsystem(row.sub_domain)}
                                                </span>
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

                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 space-y-4">
                        <h2 className="text-lg font-bold text-white">Registration Share by Domain</h2>
                        <div className="space-y-3">
                            {[...data.by_domain]
                                .sort((a, b) => b.registered - a.registered)
                                .map((row) => (
                                    <FunnelBar
                                        key={row.sub_domain}
                                        label={`${subDomainLabel(row.sub_domain)} (${subDomainSubsystem(row.sub_domain)})`}
                                        value={row.registered}
                                        max={data.overall.registered}
                                    />
                                ))}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6 space-y-4">
                        <h2 className="text-lg font-bold text-white">Selection Yield by Domain</h2>
                        <p className="text-xs text-gray-500 -mt-2">Share of each domain&apos;s registrants who were ultimately selected.</p>
                        <div className="space-y-3">
                            {[...data.by_domain]
                                .sort((a, b) => (b.registered > 0 ? b.selected / b.registered : 0) - (a.registered > 0 ? a.selected / a.registered : 0))
                                .map((row) => (
                                    <FunnelBar
                                        key={row.sub_domain}
                                        label={`${subDomainLabel(row.sub_domain)} (${subDomainSubsystem(row.sub_domain)})`}
                                        value={row.selected}
                                        max={row.registered}
                                    />
                                ))}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden">
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
                                                        <span className="ml-2 inline-flex items-center rounded-full bg-white/5 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400 ring-1 ring-inset ring-white/10">
                                                            Scheduled
                                                        </span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3 text-gray-300">
                                                    {new Date(s.session_date).toLocaleDateString()}
                                                </td>
                                                <td className="px-5 py-3 text-gray-300">
                                                    {s.has_occurred ? (
                                                        `${s.present_count} / ${data.training.total_trainees}`
                                                    ) : (
                                                        <span className="text-gray-600">—</span>
                                                    )}
                                                </td>
                                                <td className="px-5 py-3 text-gray-300">
                                                    {s.attendance_pct === null ? (
                                                        <span className="text-gray-600">—</span>
                                                    ) : (
                                                        `${s.attendance_pct}%`
                                                    )}
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
