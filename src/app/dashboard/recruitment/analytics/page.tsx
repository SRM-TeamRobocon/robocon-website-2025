"use client";

import { useEffect, useMemo, useState } from "react";
import {
    BarChart3,
    AlertTriangle,
    UserPlus,
    Presentation,
    FileText,
    ListChecks,
    Mic2,
    Hourglass,
} from "lucide-react";
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

// One tab per pipeline stage. Every stage tab renders the SAME four breakdowns (domain,
// year, gender, residence) from `stages[]` via <StageBreakdown>, plus a stage-specific
// extras block underneath. A stage with no rows yet renders an explicit "hasn't started"
// panel rather than a wall of empty charts — the tab still exists so you can see the
// pipeline is wired and waiting, which an absent tab wouldn't tell you.

interface OutcomeCounts {
    selected: number;
    rejected: number;
    waitlisted: number;
}

interface DomainFunnel {
    sub_domain: string;
    registered: number;
    orientation: number;
    exam_attended: number;
    shortlisted: number;
    interviewed: number;
    selected: number;
    interview_outcomes: OutcomeCounts;
}

interface Bucket {
    key: string;
    label: string;
    count: number;
    eligible: number;
}

interface YearSplit {
    count: number;
    eligible: number;
}

interface DomainBucket extends Bucket {
    year_1: YearSplit;
    year_2: YearSplit;
    other: YearSplit;
}

interface Stage {
    key: string;
    label: string;
    total: number;
    eligible: number;
    has_denominator: boolean;
    denominator_label: string;
    by_domain: DomainBucket[];
    by_year: Bucket[];
    by_gender: Bucket[];
    by_residence: Bucket[];
}

interface AnalyticsData {
    cycle: { id: string; name: string; year: string };
    overall: {
        registered: number;
        orientation: number;
        exam_attended: number;
        shortlisted: number;
        interviewed: number;
        selected: number;
        interview_outcomes: OutcomeCounts;
    };
    by_domain: DomainFunnel[];
    stages: Stage[];
    stage_extras: {
        registration: {
            over_time: { date: string; count: number }[];
            departments: { department: string; count: number }[];
            other_departments: number;
            distinct_departments: number;
            email_verified: number;
            email_unverified: number;
        };
        exam: {
            by_day: { day_1: number; day_2: number };
            by_domain_day: { sub_domain: string; day_1: number; day_2: number; total: number }[];
            sittings: number;
            marks_entered: number;
            marks_histogram: { label: string; count: number }[];
            marks_by_domain: {
                sub_domain: string;
                entered: number;
                average: number | null;
                min: number | null;
                max: number | null;
            }[];
        };
        shortlist: {
            status_by_domain: {
                sub_domain: string;
                pending: number;
                shortlisted: number;
                not_shortlisted: number;
            }[];
            cutoffs: { sub_domain: string; male: number | null; female: number | null }[];
            shortlisted_by_gender: {
                sub_domain: string;
                male: number;
                female: number;
                unspecified: number;
            }[];
            method: { auto: number; manual: number };
            called: number;
            evaluated: number;
        };
        interview: {
            token_status: { waiting: number; called: number; done: number; no_show: number; deferred: number };
            checked_in: number;
            walkin_tokens: number;
            no_show_rate: number | null;
            outcomes: OutcomeCounts;
            outcomes_by_domain: (OutcomeCounts & { sub_domain: string })[];
        };
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
const GENDER_COLOR: Record<string, string> = { male: "#3987e5", female: "#d95886", unspecified: "#6b6b68" };
const RESIDENCE_COLOR: Record<string, string> = { hosteller: "#3987e5", day_scholar: "#199e70" };
// Same "first series is blue, unknown bucket is the neutral grey" convention as the two
// palettes above, so the cards read as one system rather than three unrelated charts.
const YEAR_COLOR: Record<string, string> = { year_1: "#3987e5", year_2: "#c98500", other: "#6b6b68" };
// Semantic, not categorical: green reads as "through", amber as "still waiting", grey/red as
// "out". Kept distinct from the domain palette so a status chart never looks like a domain one.
const STATUS_COLOR: Record<string, string> = {
    shortlisted: "#199e70",
    pending: "#c98500",
    not_shortlisted: "#6b6b68",
    selected: "#199e70",
    waitlisted: "#c98500",
    rejected: "#d95926",
};

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

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
    return <div className={`border border-white/10 bg-black ${className}`}>{children}</div>;
}

function CardHeader({ title, caption }: { title: string; caption?: string }) {
    return (
        <div className="p-5 pb-0">
            <h2 className="text-lg font-bold text-white">{title}</h2>
            {caption && <p className="mt-1 text-xs text-gray-500">{caption}</p>}
        </div>
    );
}

function StatTile({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) {
    return (
        <Card className="p-4">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-500 mb-1">{label}</p>
            <p className="text-2xl font-black text-white">{value}</p>
            {sub && <p className="mt-1 text-xs text-gray-500">{sub}</p>}
        </Card>
    );
}

function pct(count: number, total: number): string {
    if (total <= 0) return "—";
    return `${Math.round((count / total) * 1000) / 10}%`;
}

function FunnelBar({ label, value, max }: { label: string; value: number; max: number }) {
    const p = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
        <div>
            <div className="flex items-center justify-between text-xs mb-1">
                <span className="text-gray-400 font-semibold">{label}</span>
                <span className="text-white font-bold">
                    {value} <span className="text-gray-500 font-normal">({p}% of registered)</span>
                </span>
            </div>
            <div className="h-2 bg-white/5 overflow-hidden">
                <div className="h-full bg-red transition-all" style={{ width: `${p}%` }} />
            </div>
        </div>
    );
}

// One breakdown card: a bar chart of the buckets plus the same numbers as a table. When the
// stage has a denominator, a second "of eligible" series and a conversion-% column appear —
// on Registration those would both be a tautological 100%, so they're dropped there.
function BucketSection({
    title,
    caption,
    buckets,
    hasDenominator,
    denominatorLabel,
    colorFor,
    firstColumnLabel,
    showSubsystem = false,
}: {
    title: string;
    caption?: string;
    buckets: Bucket[];
    hasDenominator: boolean;
    denominatorLabel: string;
    colorFor: (key: string) => string;
    firstColumnLabel: string;
    showSubsystem?: boolean;
}) {
    // Drop always-zero buckets ("Other" year, "Unspecified" gender) so they don't add a
    // dead bar and a dead row to every single stage tab.
    const rows = buckets.filter((b) => b.count > 0 || b.eligible > 0);
    if (rows.length === 0) return null;

    const chartData = rows.map((b) => ({
        key: b.key,
        name: b.label,
        Count: b.count,
        Eligible: b.eligible,
    }));

    return (
        <Card>
            <CardHeader title={title} caption={caption} />
            <div className="px-5 pt-4" style={{ width: "100%", height: 260 }}>
                <ResponsiveContainer>
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff12" vertical={false} />
                        <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
                        <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip content={ChartTooltip} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                        {hasDenominator && <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={8} />}
                        {hasDenominator && (
                            <Bar dataKey="Eligible" name={denominatorLabel} fill="#3a3a3a" radius={[4, 4, 0, 0]} maxBarSize={56} />
                        )}
                        <Bar dataKey="Count" name={hasDenominator ? title : "Count"} radius={[4, 4, 0, 0]} maxBarSize={56}>
                            {chartData.map((d) => (
                                <Cell key={d.key} fill={colorFor(d.key)} />
                            ))}
                        </Bar>
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto mt-4">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-white/10">
                            <th className="px-5 py-3">{firstColumnLabel}</th>
                            <th className="px-5 py-3">Count</th>
                            {hasDenominator && <th className="px-5 py-3">{denominatorLabel}</th>}
                            {hasDenominator && <th className="px-5 py-3">Rate</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((b) => (
                            <tr key={b.key} className="border-b border-white/5 last:border-0">
                                <td className="px-5 py-3 text-white font-medium">
                                    {b.label}
                                    {showSubsystem && (
                                        <span className="ml-1.5 text-xs font-normal text-gray-500">
                                            {subDomainSubsystem(b.key)}
                                        </span>
                                    )}
                                </td>
                                <td className="px-5 py-3 text-gray-300">{b.count}</td>
                                {hasDenominator && <td className="px-5 py-3 text-gray-300">{b.eligible}</td>}
                                {hasDenominator && (
                                    <td className="px-5 py-3 text-gray-300">{pct(b.count, b.eligible)}</td>
                                )}
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}

// The domain breakdown gets its own component rather than reusing BucketSection, because it
// is the one dimension that carries a second split inside it: each domain's bar is stacked
// Year 1 + Year 2, so the segment heights give the year mix and the full bar height gives the
// domain total in the same glance.
function DomainYearSection({
    stage,
}: {
    stage: Stage;
}) {
    const rows = stage.by_domain.filter((b) => b.count > 0 || b.eligible > 0);
    if (rows.length === 0) return null;

    const hasOther = rows.some((b) => b.other.count > 0 || b.other.eligible > 0);
    const denom = stage.denominator_label || "eligible";
    const denomTitle = denom.charAt(0).toUpperCase() + denom.slice(1);

    const chartData = rows.map((b) => ({
        key: b.key,
        name: b.label,
        "Year 1": b.year_1.count,
        "Year 2": b.year_2.count,
        ...(hasOther ? { Other: b.other.count } : {}),
    }));

    return (
        <Card>
            <CardHeader
                title="By Domain — Year 1 vs Year 2"
                caption={
                    stage.has_denominator
                        ? `Stacked bars: each domain's total, split by year. Rates are against everyone ${denom} for that domain and year.`
                        : "Stacked bars: each domain's total, split by year. A recruit picking two domains counts in both."
                }
            />
            <div className="px-5 pt-4" style={{ width: "100%", height: 300 }}>
                <ResponsiveContainer>
                    <BarChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff12" vertical={false} />
                        <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
                        <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                        <Tooltip content={ChartTooltip} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                        <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={8} />
                        <Bar dataKey="Year 1" stackId="year" fill={YEAR_COLOR.year_1} maxBarSize={56} />
                        <Bar
                            dataKey="Year 2"
                            stackId="year"
                            fill={YEAR_COLOR.year_2}
                            maxBarSize={56}
                            radius={hasOther ? undefined : [4, 4, 0, 0]}
                        />
                        {hasOther && (
                            <Bar dataKey="Other" stackId="year" fill={YEAR_COLOR.other} radius={[4, 4, 0, 0]} maxBarSize={56} />
                        )}
                    </BarChart>
                </ResponsiveContainer>
            </div>
            <div className="overflow-x-auto mt-4">
                <table className="w-full text-sm">
                    <thead>
                        <tr className="text-left text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-white/10">
                            <th className="px-5 py-3">Domain</th>
                            <th className="px-5 py-3">Year 1</th>
                            <th className="px-5 py-3">Year 2</th>
                            {hasOther && <th className="px-5 py-3">Other</th>}
                            <th className="px-5 py-3">Overall</th>
                            {stage.has_denominator && <th className="px-5 py-3">{denomTitle}</th>}
                            {stage.has_denominator && <th className="px-5 py-3">Rate</th>}
                        </tr>
                    </thead>
                    <tbody>
                        {rows.map((b) => {
                            const cell = (split: YearSplit) => (
                                <td className="px-5 py-3 text-gray-300">
                                    {split.count}
                                    {stage.has_denominator && (
                                        <span className="ml-1.5 text-xs text-gray-600">
                                            of {split.eligible} ({pct(split.count, split.eligible)})
                                        </span>
                                    )}
                                </td>
                            );
                            return (
                                <tr key={b.key} className="border-b border-white/5 last:border-0">
                                    <td className="px-5 py-3 text-white font-medium">
                                        {b.label}
                                        <span className="ml-1.5 text-xs font-normal text-gray-500">
                                            {subDomainSubsystem(b.key)}
                                        </span>
                                    </td>
                                    {cell(b.year_1)}
                                    {cell(b.year_2)}
                                    {hasOther && cell(b.other)}
                                    <td className="px-5 py-3 text-white font-semibold">{b.count}</td>
                                    {stage.has_denominator && <td className="px-5 py-3 text-gray-300">{b.eligible}</td>}
                                    {stage.has_denominator && (
                                        <td className="px-5 py-3 text-gray-300">{pct(b.count, b.eligible)}</td>
                                    )}
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}

function StageBreakdown({ stage }: { stage: Stage }) {
    const denom = stage.denominator_label || "Eligible";
    const denomTitle = denom.charAt(0).toUpperCase() + denom.slice(1);
    return (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatTile label={`${stage.label} total`} value={stage.total.toLocaleString()} />
                {stage.has_denominator ? (
                    <>
                        <StatTile label={denomTitle} value={stage.eligible.toLocaleString()} />
                        <StatTile
                            label="Conversion"
                            value={pct(stage.total, stage.eligible)}
                            sub={`of those ${denom}`}
                        />
                    </>
                ) : (
                    <StatTile
                        label="Domain selections"
                        value={stage.by_domain.reduce((s, b) => s + b.count, 0).toLocaleString()}
                        sub="each recruit picks 1 or 2"
                    />
                )}
            </div>

            <BucketSection
                title="By Domain"
                caption={
                    stage.has_denominator
                        ? `Per domain, against everyone ${denom} for that domain.`
                        : "Registrations per domain. A recruit picking two domains counts in both."
                }
                buckets={stage.by_domain}
                hasDenominator={stage.has_denominator}
                denominatorLabel={denomTitle}
                colorFor={(key) => DOMAIN_COLOR[key] ?? "#6b6b68"}
                firstColumnLabel="Domain"
                showSubsystem
            />
            <DomainYearSection stage={stage} />
            <BucketSection
                title="By Year"
                buckets={stage.by_year}
                hasDenominator={stage.has_denominator}
                denominatorLabel={denomTitle}
                colorFor={(key) => YEAR_COLOR[key] ?? "#6b6b68"}
                firstColumnLabel="Year"
            />
            <BucketSection
                title="By Gender"
                buckets={stage.by_gender}
                hasDenominator={stage.has_denominator}
                denominatorLabel={denomTitle}
                colorFor={(key) => GENDER_COLOR[key] ?? "#6b6b68"}
                firstColumnLabel="Gender"
            />
            <BucketSection
                title="By Residence"
                buckets={stage.by_residence}
                hasDenominator={stage.has_denominator}
                denominatorLabel={denomTitle}
                colorFor={(key) => RESIDENCE_COLOR[key] ?? "#6b6b68"}
                firstColumnLabel="Residence"
            />
        </>
    );
}

function NotStarted({ stage }: { stage: Stage }) {
    return (
        <Card className="p-8">
            <div className="flex items-start gap-3">
                <Hourglass className="w-6 h-6 text-amber-400 shrink-0 mt-0.5" />
                <div>
                    <p className="text-white font-bold">{stage.label} hasn&apos;t started yet</p>
                    <p className="mt-1 text-sm text-gray-400">
                        Nothing recorded for this stage in the active cycle.
                        {stage.has_denominator && stage.eligible > 0 && (
                            <>
                                {" "}
                                <span className="text-gray-300">{stage.eligible.toLocaleString()}</span> recruits are{" "}
                                {stage.denominator_label} and waiting on it.
                            </>
                        )}
                    </p>
                    <p className="mt-2 text-xs text-gray-600">
                        This tab fills in on its own as soon as the first row lands — nothing to switch on.
                    </p>
                </div>
            </div>
        </Card>
    );
}

const TABS = [
    { key: "overview", label: "Overview", icon: BarChart3 },
    { key: "registration", label: "Registration", icon: UserPlus },
    { key: "orientation", label: "Orientation", icon: Presentation },
    { key: "exam", label: "Exam", icon: FileText },
    { key: "shortlist", label: "Shortlist", icon: ListChecks },
    { key: "interview", label: "Interview", icon: Mic2 },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export default function RecruitmentAnalyticsPage() {
    const ready = useRequireRole(["member", "lead", "admin"]);
    const [data, setData] = useState<AnalyticsData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<TabKey>("overview");

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

    const stageByKey = useMemo(() => {
        const map = new Map<string, Stage>();
        for (const s of data?.stages ?? []) map.set(s.key, s);
        return map;
    }, [data]);

    if (!ready) return null;

    const header = (
        <div>
            <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                <BarChart3 className="w-7 h-7 text-red" />
                Recruitment Analytics
            </h1>
            <p className="mt-2 text-gray-400 text-sm max-w-xl">
                Stage-by-stage breakdown of the active cycle. Each stage is measured against the stage
                before it, so the rates read as conversion, not share of everyone.
            </p>
        </div>
    );

    if (loading) {
        return (
            <div className="space-y-6">
                {header}
                <Card className="p-8 text-center text-gray-500 text-sm">Loading...</Card>
            </div>
        );
    }

    if (error || !data) {
        return (
            <div className="space-y-6">
                {header}
                <Card className="p-8 flex items-center gap-3">
                    <AlertTriangle className="w-6 h-6 text-amber-400" />
                    <p className="text-gray-300 text-sm">{error || "Could not load analytics"}</p>
                </Card>
            </div>
        );
    }

    const { overall, by_domain, stage_extras } = data;
    const stage = stageByKey.get(tab);

    return (
        <div className="space-y-6">
            {header}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <StatTile label="Active Cycle" value={<span className="text-xl">{data.cycle.name}</span>} sub={data.cycle.year} />
                <StatTile label="Total Registered" value={overall.registered.toLocaleString()} />
            </div>

            <div className="flex flex-wrap items-center gap-2 border-b border-white/10 pb-3">
                {TABS.map((t) => {
                    const Icon = t.icon;
                    return (
                        <button
                            key={t.key}
                            onClick={() => setTab(t.key)}
                            className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold transition ${
                                tab === t.key
                                    ? "bg-red/15 text-white ring-1 ring-inset ring-red/40"
                                    : "text-gray-400 hover:bg-white/5"
                            }`}
                        >
                            <Icon className="w-4 h-4" />
                            {t.label}
                        </button>
                    );
                })}
            </div>

            {tab === "overview" && <OverviewTab overall={overall} byDomain={by_domain} />}

            {tab !== "overview" && stage && (
                <div className="space-y-6">
                    {stage.total === 0 && stage.key !== "registration" ? (
                        <NotStarted stage={stage} />
                    ) : (
                        <StageBreakdown stage={stage} />
                    )}

                    {tab === "registration" && <RegistrationExtras extras={stage_extras.registration} />}
                    {tab === "exam" && <ExamExtras extras={stage_extras.exam} />}
                    {tab === "shortlist" && <ShortlistExtras extras={stage_extras.shortlist} />}
                    {tab === "interview" && <InterviewExtras extras={stage_extras.interview} />}
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Overview
// ---------------------------------------------------------------------------

const FUNNEL_STAGES: { key: keyof AnalyticsData["overall"]; label: string }[] = [
    { key: "registered", label: "Registered" },
    { key: "orientation", label: "Attended orientation" },
    { key: "exam_attended", label: "Sat an exam" },
    { key: "shortlisted", label: "Shortlisted" },
    { key: "interviewed", label: "Interviewed" },
    { key: "selected", label: "Selected" },
];

function OverviewTab({
    overall,
    byDomain,
}: {
    overall: AnalyticsData["overall"];
    byDomain: DomainFunnel[];
}) {
    const domainChartData = [...byDomain]
        .sort((a, b) => b.registered - a.registered)
        .map((row) => ({ sub_domain: row.sub_domain, name: subDomainLabel(row.sub_domain), Registered: row.registered }));

    const outcomes = overall.interview_outcomes;
    const outcomeTotal = outcomes.selected + outcomes.rejected + outcomes.waitlisted;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                {FUNNEL_STAGES.map((s) => (
                    <Card key={s.key} className="p-4">
                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{s.label}</p>
                        <p className="text-2xl font-black text-white">
                            {(overall[s.key] as number).toLocaleString()}
                        </p>
                        <p className="mt-0.5 text-[11px] text-gray-600">
                            {s.key === "registered" ? "—" : `${pct(overall[s.key] as number, overall.registered)} of registered`}
                        </p>
                    </Card>
                ))}
            </div>

            <Card>
                <CardHeader
                    title="Overall Funnel"
                    caption="Distinct recruits at each stage. Someone who applied to two domains is counted once here."
                />
                <div className="p-5 space-y-3">
                    {FUNNEL_STAGES.map((s) => (
                        <FunnelBar
                            key={s.key}
                            label={s.label}
                            value={overall[s.key] as number}
                            max={overall.registered}
                        />
                    ))}
                </div>
            </Card>

            <Card>
                <CardHeader title="Registration Share by Domain" caption="A recruit picking two domains counts in both." />
                <div className="px-5 pt-4" style={{ width: "100%", height: 280 }}>
                    <ResponsiveContainer>
                        <BarChart data={domainChartData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff12" vertical={false} />
                            <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
                            <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip content={ChartTooltip} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                            <Bar dataKey="Registered" radius={[4, 4, 0, 0]} maxBarSize={56}>
                                {domainChartData.map((d) => (
                                    <Cell key={d.sub_domain} fill={DOMAIN_COLOR[d.sub_domain] ?? "#6b6b68"} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className="p-5 space-y-3">
                    {domainChartData.map((row) => (
                        <FunnelBar
                            key={row.sub_domain}
                            label={`${row.name} (${subDomainSubsystem(row.sub_domain)})`}
                            value={row.Registered}
                            max={overall.registered}
                        />
                    ))}
                </div>
            </Card>

            <Card>
                <CardHeader
                    title="Breakdown by Sub-Domain"
                    caption="Per-domain rows count one entry per domain selection, so they sum to more than the overall figures above."
                />
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
                            </tr>
                        </thead>
                        <tbody>
                            {byDomain.map((row) => (
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
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>

            {outcomeTotal > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <StatTile label="Selected" value={outcomes.selected} sub={pct(outcomes.selected, outcomeTotal)} />
                    <StatTile label="Waitlisted" value={outcomes.waitlisted} sub={pct(outcomes.waitlisted, outcomeTotal)} />
                    <StatTile label="Rejected" value={outcomes.rejected} sub={pct(outcomes.rejected, outcomeTotal)} />
                </div>
            )}
        </div>
    );
}

// ---------------------------------------------------------------------------
// Stage-specific extras
// ---------------------------------------------------------------------------

function RegistrationExtras({ extras }: { extras: AnalyticsData["stage_extras"]["registration"] }) {
    const overTime = extras.over_time.map((d) => ({
        name: d.date.slice(5), // MM-DD — the year is the same for every point
        Registrations: d.count,
    }));
    const departments = [
        ...extras.departments.map((d) => ({ name: d.department, Recruits: d.count })),
        ...(extras.other_departments > 0 ? [{ name: "Other", Recruits: extras.other_departments }] : []),
    ];

    return (
        <>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <StatTile label="Email verified" value={extras.email_verified.toLocaleString()} />
                <StatTile label="Not verified" value={extras.email_unverified.toLocaleString()} />
                <StatTile label="Departments" value={extras.distinct_departments} sub="after normalising spelling" />
            </div>

            {overTime.length > 0 && (
                <Card>
                    <CardHeader title="Registrations Over Time" caption="Sign-ups per day, IST." />
                    <div className="px-5 py-4" style={{ width: "100%", height: 260 }}>
                        <ResponsiveContainer>
                            <BarChart data={overTime} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff12" vertical={false} />
                                <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
                                <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip content={ChartTooltip} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                                <Bar dataKey="Registrations" fill="#3987e5" radius={[4, 4, 0, 0]} maxBarSize={36} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            )}

            {departments.length > 0 && (
                <Card>
                    <CardHeader
                        title="Departments"
                        caption="Department is free text at registration, so spellings are merged for grouping (ECE and Ece count as one). The label is the most common spelling in each group."
                    />
                    <div className="px-5 py-4" style={{ width: "100%", height: Math.max(260, departments.length * 28) }}>
                        <ResponsiveContainer>
                            <BarChart data={departments} layout="vertical" margin={{ top: 8, right: 16, left: 8, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff12" horizontal={false} />
                                <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                                <YAxis
                                    type="category"
                                    dataKey="name"
                                    tick={axisTick}
                                    axisLine={false}
                                    tickLine={false}
                                    width={120}
                                />
                                <Tooltip content={ChartTooltip} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                                <Bar dataKey="Recruits" fill="#3987e5" radius={[0, 4, 4, 0]} maxBarSize={18} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            )}
        </>
    );
}

function ExamExtras({ extras }: { extras: AnalyticsData["stage_extras"]["exam"] }) {
    const histogram = extras.marks_histogram.map((b) => ({ name: b.label, Recruits: b.count }));
    const dayData = extras.by_domain_day.map((row) => ({
        key: row.sub_domain,
        name: subDomainLabel(row.sub_domain),
        "Day 1": row.day_1,
        "Day 2": row.day_2,
    }));

    return (
        <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatTile label="Day 1 scans" value={extras.by_day.day_1.toLocaleString()} />
                <StatTile label="Day 2 scans" value={extras.by_day.day_2.toLocaleString()} />
                <StatTile
                    label="Total sittings"
                    value={extras.sittings.toLocaleString()}
                    sub="one per recruit per domain"
                />
                <StatTile label="Marks entered" value={extras.marks_entered.toLocaleString()} />
            </div>

            <Card>
                <CardHeader
                    title="By Domain — Day 1 vs Day 2"
                    caption="Exam attendance is one row per recruit per domain, so a domain's Day 1 and Day 2 counts add up to its total attendees — nobody is double-counted."
                />
                <div className="px-5 pt-4" style={{ width: "100%", height: 300 }}>
                    <ResponsiveContainer>
                        <BarChart data={dayData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff12" vertical={false} />
                            <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
                            <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip content={ChartTooltip} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                            <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={8} />
                            <Bar dataKey="Day 1" stackId="day" fill="#3987e5" maxBarSize={56} />
                            <Bar dataKey="Day 2" stackId="day" fill="#c98500" radius={[4, 4, 0, 0]} maxBarSize={56} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className="overflow-x-auto mt-4">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-white/10">
                                <th className="px-5 py-3">Domain</th>
                                <th className="px-5 py-3">Day 1</th>
                                <th className="px-5 py-3">Day 2</th>
                                <th className="px-5 py-3">Overall</th>
                            </tr>
                        </thead>
                        <tbody>
                            {extras.by_domain_day.map((row) => (
                                <tr key={row.sub_domain} className="border-b border-white/5 last:border-0">
                                    <td className="px-5 py-3 text-white font-medium">
                                        {subDomainLabel(row.sub_domain)}
                                        <span className="ml-1.5 text-xs font-normal text-gray-500">
                                            {subDomainSubsystem(row.sub_domain)}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-gray-300">{row.day_1}</td>
                                    <td className="px-5 py-3 text-gray-300">{row.day_2}</td>
                                    <td className="px-5 py-3 text-white font-semibold">{row.total}</td>
                                </tr>
                            ))}
                            <tr className="border-t border-white/10 bg-white/[0.02]">
                                <td className="px-5 py-3 text-white font-bold">All domains</td>
                                <td className="px-5 py-3 text-gray-300 font-semibold">{extras.by_day.day_1}</td>
                                <td className="px-5 py-3 text-gray-300 font-semibold">{extras.by_day.day_2}</td>
                                <td className="px-5 py-3 text-white font-bold">{extras.sittings}</td>
                            </tr>
                        </tbody>
                    </table>
                </div>
            </Card>

            {extras.marks_entered > 0 ? (
                <Card>
                    <CardHeader title="Marks Distribution" caption="All domains combined, in 10-mark bands." />
                    <div className="px-5 py-4" style={{ width: "100%", height: 260 }}>
                        <ResponsiveContainer>
                            <BarChart data={histogram} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff12" vertical={false} />
                                <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
                                <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip content={ChartTooltip} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                                <Bar dataKey="Recruits" fill="#199e70" radius={[4, 4, 0, 0]} maxBarSize={48} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            ) : (
                <Card className="p-6">
                    <p className="text-sm text-gray-400">
                        No marks entered yet — the distribution and per-domain averages appear as evaluators
                        save them on the{" "}
                        <span className="text-gray-300">Marks</span> page.
                    </p>
                </Card>
            )}

            <Card>
                <CardHeader title="Marks by Domain" caption="Only counts recruits who have a marks row for that domain." />
                <div className="overflow-x-auto mt-4">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-white/10">
                                <th className="px-5 py-3">Domain</th>
                                <th className="px-5 py-3">Entered</th>
                                <th className="px-5 py-3">Average</th>
                                <th className="px-5 py-3">Min</th>
                                <th className="px-5 py-3">Max</th>
                            </tr>
                        </thead>
                        <tbody>
                            {extras.marks_by_domain.map((row) => (
                                <tr key={row.sub_domain} className="border-b border-white/5 last:border-0">
                                    <td className="px-5 py-3 text-white font-medium">
                                        {subDomainLabel(row.sub_domain)}
                                        <span className="ml-1.5 text-xs font-normal text-gray-500">
                                            {subDomainSubsystem(row.sub_domain)}
                                        </span>
                                    </td>
                                    <td className="px-5 py-3 text-gray-300">{row.entered}</td>
                                    <td className="px-5 py-3 text-gray-300">{row.average ?? "—"}</td>
                                    <td className="px-5 py-3 text-gray-300">{row.min ?? "—"}</td>
                                    <td className="px-5 py-3 text-gray-300">{row.max ?? "—"}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </>
    );
}

function ShortlistExtras({ extras }: { extras: AnalyticsData["stage_extras"]["shortlist"] }) {
    const statusData = extras.status_by_domain.map((row) => ({
        name: subDomainLabel(row.sub_domain),
        Shortlisted: row.shortlisted,
        Pending: row.pending,
        "Not shortlisted": row.not_shortlisted,
    }));
    const genderData = extras.shortlisted_by_gender.map((row) => ({
        name: subDomainLabel(row.sub_domain),
        Male: row.male,
        Female: row.female,
    }));
    const missingCutoffs = extras.cutoffs.filter((c) => c.male === null || c.female === null);

    return (
        <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatTile label="Evaluated" value={extras.evaluated.toLocaleString()} sub="rows in the shortlist table" />
                <StatTile label="Auto" value={extras.method.auto.toLocaleString()} sub="from the cutoff engine" />
                <StatTile label="Manual override" value={extras.method.manual.toLocaleString()} />
                <StatTile label="Called" value={extras.called.toLocaleString()} sub="confirmed by phone" />
            </div>

            {missingCutoffs.length > 0 && (
                <Card className="p-4 border-amber-500/30">
                    <div className="flex items-start gap-3">
                        <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                        <p className="text-sm text-gray-300">
                            <span className="font-bold text-white">
                                {missingCutoffs.length} domain{missingCutoffs.length === 1 ? "" : "s"}
                            </span>{" "}
                            {missingCutoffs.length === 1 ? "is" : "are"} missing a cutoff for at least one gender (
                            {missingCutoffs.map((c) => subDomainLabel(c.sub_domain)).join(", ")}). The shortlist
                            engine skips a domain entirely until both are set, which is why those rows read zero.
                        </p>
                    </div>
                </Card>
            )}

            <Card>
                <CardHeader title="Status by Domain" caption="Every shortlist row for the cycle, by outcome." />
                <div className="px-5 pt-4" style={{ width: "100%", height: 280 }}>
                    <ResponsiveContainer>
                        <BarChart data={statusData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff12" vertical={false} />
                            <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
                            <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip content={ChartTooltip} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                            <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={8} />
                            <Bar dataKey="Shortlisted" fill={STATUS_COLOR.shortlisted} radius={[4, 4, 0, 0]} maxBarSize={28} />
                            <Bar dataKey="Pending" fill={STATUS_COLOR.pending} radius={[4, 4, 0, 0]} maxBarSize={28} />
                            <Bar
                                dataKey="Not shortlisted"
                                fill={STATUS_COLOR.not_shortlisted}
                                radius={[4, 4, 0, 0]}
                                maxBarSize={28}
                            />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
            </Card>

            <Card>
                <CardHeader
                    title="Cutoffs and Shortlisted, by Gender"
                    caption="Cutoffs are set per gender per domain (migration 013), so the shortlist splits the same way."
                />
                <div className="px-5 pt-4" style={{ width: "100%", height: 260 }}>
                    <ResponsiveContainer>
                        <BarChart data={genderData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#ffffff12" vertical={false} />
                            <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
                            <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                            <Tooltip content={ChartTooltip} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                            <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={8} />
                            <Bar dataKey="Male" fill={GENDER_COLOR.male} radius={[4, 4, 0, 0]} maxBarSize={28} />
                            <Bar dataKey="Female" fill={GENDER_COLOR.female} radius={[4, 4, 0, 0]} maxBarSize={28} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>
                <div className="overflow-x-auto mt-4">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-white/10">
                                <th className="px-5 py-3">Domain</th>
                                <th className="px-5 py-3">Cutoff (M)</th>
                                <th className="px-5 py-3">Cutoff (F)</th>
                                <th className="px-5 py-3">Shortlisted (M)</th>
                                <th className="px-5 py-3">Shortlisted (F)</th>
                            </tr>
                        </thead>
                        <tbody>
                            {extras.cutoffs.map((c) => {
                                const g = extras.shortlisted_by_gender.find((s) => s.sub_domain === c.sub_domain);
                                return (
                                    <tr key={c.sub_domain} className="border-b border-white/5 last:border-0">
                                        <td className="px-5 py-3 text-white font-medium">
                                            {subDomainLabel(c.sub_domain)}
                                            <span className="ml-1.5 text-xs font-normal text-gray-500">
                                                {subDomainSubsystem(c.sub_domain)}
                                            </span>
                                        </td>
                                        <td className={`px-5 py-3 ${c.male === null ? "text-amber-400" : "text-gray-300"}`}>
                                            {c.male ?? "not set"}
                                        </td>
                                        <td className={`px-5 py-3 ${c.female === null ? "text-amber-400" : "text-gray-300"}`}>
                                            {c.female ?? "not set"}
                                        </td>
                                        <td className="px-5 py-3 text-gray-300">{g?.male ?? 0}</td>
                                        <td className="px-5 py-3 text-gray-300">{g?.female ?? 0}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </Card>
        </>
    );
}

function InterviewExtras({ extras }: { extras: AnalyticsData["stage_extras"]["interview"] }) {
    const t = extras.token_status;
    const outcomeData = extras.outcomes_by_domain.map((row) => ({
        name: subDomainLabel(row.sub_domain),
        Selected: row.selected,
        Waitlisted: row.waitlisted,
        Rejected: row.rejected,
    }));
    const hasOutcomes = extras.outcomes.selected + extras.outcomes.rejected + extras.outcomes.waitlisted > 0;

    return (
        <>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <StatTile label="Checked in" value={extras.checked_in.toLocaleString()} sub="distinct recruits" />
                <StatTile label="Walk-ins" value={extras.walkin_tokens.toLocaleString()} sub="not shortlisted, let in anyway" />
                <StatTile
                    label="No-show rate"
                    value={extras.no_show_rate === null ? "—" : `${extras.no_show_rate}%`}
                    sub="of tokens that were resolved"
                />
                <StatTile label="Still waiting" value={t.waiting.toLocaleString()} />
            </div>

            <Card>
                <CardHeader title="Queue Tokens" caption="Every interview token issued this cycle, by current status." />
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-px bg-white/10 mt-4">
                    {(
                        [
                            ["Waiting", t.waiting],
                            ["Called", t.called],
                            ["Done", t.done],
                            ["No-show", t.no_show],
                            ["Deferred", t.deferred],
                        ] as const
                    ).map(([label, value]) => (
                        <div key={label} className="bg-black p-4">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1">{label}</p>
                            <p className="text-xl font-black text-white">{value}</p>
                        </div>
                    ))}
                </div>
            </Card>

            {hasOutcomes && (
                <Card>
                    <CardHeader title="Outcomes by Domain" caption="Logged interview results, one row per recruit per domain." />
                    <div className="px-5 pt-4" style={{ width: "100%", height: 280 }}>
                        <ResponsiveContainer>
                            <BarChart data={outcomeData} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff12" vertical={false} />
                                <XAxis dataKey="name" tick={axisTick} axisLine={false} tickLine={false} />
                                <YAxis tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
                                <Tooltip content={ChartTooltip} cursor={{ fill: "rgba(255,255,255,0.04)" }} />
                                <Legend wrapperStyle={legendStyle} iconType="circle" iconSize={8} />
                                <Bar dataKey="Selected" fill={STATUS_COLOR.selected} radius={[4, 4, 0, 0]} maxBarSize={28} />
                                <Bar dataKey="Waitlisted" fill={STATUS_COLOR.waitlisted} radius={[4, 4, 0, 0]} maxBarSize={28} />
                                <Bar dataKey="Rejected" fill={STATUS_COLOR.rejected} radius={[4, 4, 0, 0]} maxBarSize={28} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </Card>
            )}
        </>
    );
}
