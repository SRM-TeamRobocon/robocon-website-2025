"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import {
    Radio,
    Plus,
    PhoneCall,
    CheckCircle2,
    Clock3,
    Award,
    Ban,
    Hourglass,
    Trash2,
    ClipboardList,
    Pencil,
    X,
    ChevronDown,
    Footprints,
    ArrowLeft,
    Download,
    Users,
    RefreshCw,
} from "lucide-react";
import { useRequireRole } from "@/hooks/use-require-role";
import {
    RECRUIT_SUBDOMAINS,
    subDomainLabel,
    subDomainFullLabel,
    subDomainSubsystem,
    groupBySubsystem,
    type RecruitSubDomain,
} from "@/lib/recruit-domains";
import RecruitProfileCard, { type RecruitProfileCardToken } from "@/components/recruit/RecruitProfileCard";
import { GENDERS, genderLabel } from "@/lib/gender";
import { RECRUIT_YEARS, recruitYearLabel } from "@/lib/recruit-year";
import { travelMethodLabel } from "@/lib/travel-method";
import Select from "@/components/ui/select";

// This page used to be a single "every table at once" board. It's now step 1/2 of a
// picker: choose a domain, then either join one of that domain's open tables or start a
// new one - either way you're routed to /dashboard/recruitment/interview/[panelId], a
// dedicated page for just that one table (see that file for the actual call/queue UI).
// This page keeps only: the domain picker, the join/create list for the selected domain,
// and the cycle-wide InterviewResultsList (still relevant regardless of which table you're
// working from).

type TokenStatus = "waiting" | "called" | "done" | "no_show";

interface PanelCounts {
    waiting: number;
    called: number;
    done: number;
    no_show: number;
}

interface Panel {
    id: string;
    domain_label: string;
    sub_domain: string | null;
    table_number: number | null;
    is_active: boolean;
    created_at: string;
    created_by: string;
    counts: PanelCounts;
}

// Scoped to a single, already-known sub_domain - every call site now lives inside that
// domain's own row, so there's no dropdown to pick from any more (the row IS the pick).
// table_number/routing is still auto-allocated server-side regardless of the name typed
// here.
function AddPanelForm({ subDomain, onCreated }: { subDomain: RecruitSubDomain; onCreated: () => void }) {
    const [open, setOpen] = useState(false);
    const meta = RECRUIT_SUBDOMAINS.find((d) => d.key === subDomain);
    const defaultName = meta ? `${meta.subsystem}-${meta.label}-` : "";
    const [name, setName] = useState(defaultName);
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        const trimmedName = name.trim();
        if (!trimmedName) {
            toast.error("Enter a table name");
            return;
        }
        setBusy(true);
        try {
            const res = await fetch("/api/admin/recruitment/panels", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ sub_domain: subDomain, name: trimmedName }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(`${data.domain_label} is live`);
                setName(defaultName);
                setOpen(false);
                onCreated();
            } else {
                toast.error(data.error || "Could not create table");
            }
        } finally {
            setBusy(false);
        }
    };

    if (!open) {
        return (
            <button
                onClick={() => setOpen(true)}
                className="inline-flex shrink-0 items-center gap-1.5 bg-red/15 px-3 py-1.5 text-xs font-semibold text-red ring-1 ring-inset ring-red/40 transition hover:bg-red/25"
            >
                <Plus className="h-3.5 w-3.5" /> Add Table
            </button>
        );
    }

    return (
        <div className="border border-white/10 bg-black p-3 space-y-2">
            <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                maxLength={50}
                placeholder="Table name"
                className="w-full border-0 bg-white/5 py-1.5 px-2.5 text-xs text-white ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500"
            />
            <div className="flex gap-2">
                <button
                    onClick={submit}
                    disabled={busy}
                    className="flex-1 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/30 transition hover:bg-emerald-500/25 disabled:opacity-50"
                >
                    Create
                </button>
                <button
                    onClick={() => {
                        setOpen(false);
                        setName(defaultName);
                    }}
                    disabled={busy}
                    className="bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-400 ring-1 ring-inset ring-white/10 transition hover:bg-white/10"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}

// Shared by PanelCard's Pause / Close-for-Day / Delete network calls (the [panelId] page
// has its own copy for TableControls) - kept as two small copies rather than a shared
// module so each page stays self-contained per the two-file split.
function usePanelActions(panel: Panel, onChanged: () => void) {
    const [busy, setBusy] = useState(false);

    // Reversible pause - Reopen brings back any stranded `waiting` tokens exactly as they
    // were. Nobody is moved anywhere.
    const closePanel = async () => {
        if (!confirm(`Pause "${panel.domain_label}"? Remaining waiting tokens are left as-is. Reopen brings them back.`)) return;
        setBusy(true);
        try {
            const res = await fetch(`/api/admin/recruitment/panels/${panel.id}/close`, { method: "PATCH" });
            const data = await res.json();
            if (res.ok && data.closed) {
                toast.success("Table paused");
                onChanged();
            } else {
                toast.error(data.error || "Could not close table");
            }
        } finally {
            setBusy(false);
        }
    };

    // Reverses closePanel - was previously dead-ended (the route existed,
    // src/app/api/admin/recruitment/panels/[id]/reopen/route.ts, but no UI ever called it,
    // and a paused table was also filtered out of the domain's table list below so there was
    // nowhere to even find a paused table to reopen it). Fixed 2026-09-04.
    const reopenPanel = async () => {
        setBusy(true);
        try {
            const res = await fetch(`/api/admin/recruitment/panels/${panel.id}/reopen`, { method: "PATCH" });
            const data = await res.json();
            if (res.ok && data.reopened) {
                toast.success("Table resumed");
                onChanged();
            } else {
                toast.error(data.error || "Could not resume table");
            }
        } finally {
            setBusy(false);
        }
    };

    // Non-reversible: closes the table for good AND redistributes anyone still waiting to
    // another open table for the same domain, or defers them if none is open.
    const closeForDay = async () => {
        if (
            !confirm(
                `Close "${panel.domain_label}" for the day? Anyone still waiting will be moved to another open table for the same domain, or told to come back another day if none is open. This is not reversible.`
            )
        )
            return;
        setBusy(true);
        try {
            const res = await fetch(`/api/admin/recruitment/panels/${panel.id}/close-for-day`, { method: "PATCH" });
            const data = await res.json();
            if (res.ok && data.closed_for_day) {
                const parts = [];
                if (data.moved > 0) parts.push(`${data.moved} moved to another table`);
                if (data.deferred > 0) parts.push(`${data.deferred} deferred to another day`);
                toast.success(parts.length > 0 ? `Table closed: ${parts.join(", ")}` : "Table closed for the day");
                onChanged();
            } else {
                toast.error(data.error || "Could not close this table");
            }
        } finally {
            setBusy(false);
        }
    };

    // Hard delete - drops the panel row entirely. Waiting recruits are redistributed just
    // like Close for the Day, and any historical tokens (called/done/no_show/deferred) are
    // silently reattached to another table so the row can go. Interview results already
    // logged are keyed on recruit+domain, not panel, so they are unaffected either way.
    const deletePanel = async () => {
        const queued = panel.counts.waiting + panel.counts.called;
        const warning =
            queued > 0
                ? `\n\n${queued} recruit(s) are still queued on this table. They'll be redistributed to another open table for the same domain, or deferred to another day if none is open.`
                : "";
        if (!confirm(`Permanently delete the "${panel.domain_label}" table?${warning}\n\nThis cannot be undone.`)) return;
        setBusy(true);
        try {
            const res = await fetch(`/api/admin/recruitment/panels/${panel.id}`, { method: "DELETE" });
            const data = await res.json();
            if (res.ok && data.deleted) {
                const parts = [];
                if (data.moved > 0) parts.push(`${data.moved} moved`);
                if (data.deferred > 0) parts.push(`${data.deferred} deferred`);
                toast.success(`Deleted "${panel.domain_label}"${parts.length > 0 ? `: ${parts.join(", ")}` : ""}`);
                onChanged();
            } else {
                toast.error(data.error || "Could not delete table");
            }
        } finally {
            setBusy(false);
        }
    };

    return { busy, closePanel, reopenPanel, closeForDay, deletePanel };
}

// Compact summary card for one table (name, counts, its own Pause/Close/Delete). Used here
// for the "choose an existing open table" list in step 2 - a separate "Join This Table"
// button sits below each card (see the page component) rather than making the whole card
// clickable, so a Pause/Delete click here can never also be read as "join".
function PanelCard({ panel, onChanged }: { panel: Panel; onChanged: () => void }) {
    const { busy, closePanel, reopenPanel, closeForDay, deletePanel } = usePanelActions(panel, onChanged);

    return (
        <div className="border border-white/10 bg-black p-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
                <div className="flex items-center gap-2 min-w-0">
                    <span className={`h-2 w-2 shrink-0 ${panel.is_active ? "bg-emerald-400" : "bg-gray-600"}`} />
                    <h3 className="truncate text-sm font-bold text-white">{panel.domain_label}</h3>
                    {!panel.is_active && (
                        <span className="shrink-0 bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                            Closed
                        </span>
                    )}
                </div>
                <div className="flex flex-wrap gap-1.5 text-[11px]">
                    {/* No per-table "waiting" badge any more (migration 024) - waiting
                        recruits belong to the whole domain's shared pool, not this specific
                        table. See the domain-wide count above the table list instead. */}
                    <span className="inline-flex items-center gap-1 bg-blue-500/10 px-1.5 py-0.5 font-semibold text-blue-400 ring-1 ring-inset ring-blue-500/20">
                        <PhoneCall className="h-3 w-3" /> {panel.counts.called}
                    </span>
                    <span className="inline-flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
                        <CheckCircle2 className="h-3 w-3" /> {panel.counts.done}
                    </span>
                </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
                {panel.is_active ? (
                    <>
                        <button
                            onClick={closePanel}
                            disabled={busy}
                            className="inline-flex items-center gap-1 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
                        >
                            Pause
                        </button>
                        <button
                            onClick={closeForDay}
                            disabled={busy}
                            className="inline-flex items-center gap-1 bg-red-500/15 px-2.5 py-1 text-[11px] font-semibold text-red-400 ring-1 ring-inset ring-red-500/30 transition hover:bg-red-500/25 disabled:opacity-50"
                        >
                            Close for the Day
                        </button>
                    </>
                ) : (
                    <button
                        onClick={reopenPanel}
                        disabled={busy}
                        className="inline-flex items-center gap-1 bg-emerald-500/15 px-2.5 py-1 text-[11px] font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/30 transition hover:bg-emerald-500/25 disabled:opacity-50"
                    >
                        Resume
                    </button>
                )}
                <button
                    onClick={deletePanel}
                    disabled={busy}
                    className="ml-auto inline-flex items-center gap-1 bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold text-red-400 ring-1 ring-inset ring-red-500/30 transition hover:bg-red-500/25 disabled:opacity-50"
                >
                    <Trash2 className="h-3 w-3" /> Delete
                </button>
            </div>
        </div>
    );
}

interface InterviewResultRow {
    id: string;
    recruit_id: string;
    name: string;
    reg_no: string;
    sub_domain: string;
    result: "selected" | "rejected" | "waitlisted";
    notes: string | null;
    is_walkin: boolean;
    interviewer_username: string;
    decided_at: string | null;
    // Resolved live through this recruit's current interview token - null if no token
    // matches (shouldn't happen) or the token's panel was hard-deleted (paused/closed
    // panels still resolve, since the panel page itself shows a "closed" state for those).
    panel_id: string | null;
    panel_is_active: boolean | null;
    panel_label: string | null;
}

const RESULT_STYLES: Record<InterviewResultRow["result"], string> = {
    selected: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30",
    rejected: "bg-red-500/10 text-red-400 ring-red-500/30",
    waitlisted: "bg-amber-500/10 text-amber-400 ring-amber-500/30",
};

// Groups results by domain, RECRUIT_SUBDOMAINS order first (so sections always appear in
// the same place regardless of interview order), any unrecognised domain appended after -
// defensive only, the DB enum should never produce one.
function groupResultsByDomain(rows: InterviewResultRow[]): { sub_domain: string; rows: InterviewResultRow[] }[] {
    const bySub = new Map<string, InterviewResultRow[]>();
    for (const row of rows) {
        const bucket = bySub.get(row.sub_domain);
        if (bucket) bucket.push(row);
        else bySub.set(row.sub_domain, [row]);
    }

    const ordered: { sub_domain: string; rows: InterviewResultRow[] }[] = [];
    for (const d of RECRUIT_SUBDOMAINS) {
        const bucket = bySub.get(d.key);
        if (bucket && bucket.length > 0) {
            ordered.push({ sub_domain: d.key, rows: bucket });
            bySub.delete(d.key);
        }
    }
    for (const [sub_domain, bucket] of Array.from(bySub.entries())) {
        ordered.push({ sub_domain, rows: bucket });
    }
    return ordered;
}

// Editing a past decision re-POSTs to the same upsert endpoint the panel dashboard
// uses, WITHOUT a panel_id - per the route's documented judgment call, omitting it
// means the correction only touches the result row (and recomputes is_selected),
// never token state. This is the only place in the app a logged result can be seen
// or fixed after the fact - logging a result removes it from a table's own view
// entirely once the token flips to `done`.
function EditResultRow({ row, onSaved, onCancel }: { row: InterviewResultRow; onSaved: () => void; onCancel: () => void }) {
    const [notes, setNotes] = useState(row.notes ?? "");
    const [busy, setBusy] = useState(false);

    const submit = async (result: InterviewResultRow["result"]) => {
        setBusy(true);
        try {
            const res = await fetch("/api/admin/recruitment/interview-results", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    recruit_id: row.recruit_id,
                    sub_domain: row.sub_domain,
                    result,
                    notes: notes.trim() || undefined,
                }),
            });
            const data = await res.json();
            if (res.ok && data.saved) {
                toast.success("Result updated");
                onSaved();
            } else {
                toast.error(data.error || "Could not update result");
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <tr className="border-b border-white/5 last:border-0 bg-white/[0.02]">
            <td colSpan={6} className="px-5 py-4">
                <div className="flex flex-wrap items-center gap-3">
                    <span className="text-sm text-gray-400">
                        Correcting <span className="text-white font-semibold">{row.name}</span>: {subDomainFullLabel(row.sub_domain)}
                    </span>
                    <input
                        value={notes}
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="Notes (optional)"
                        className="flex-1 min-w-[160px] border-0 bg-white/5 py-1.5 px-3 text-sm text-white ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        onClick={() => submit("selected")}
                        disabled={busy}
                        className="inline-flex items-center gap-1 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-50"
                    >
                        <Award className="h-3.5 w-3.5" /> Selected
                    </button>
                    <button
                        onClick={() => submit("rejected")}
                        disabled={busy}
                        className="inline-flex items-center gap-1 bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-400 ring-1 ring-inset ring-red-500/30 hover:bg-red-500/25 disabled:opacity-50"
                    >
                        <Ban className="h-3.5 w-3.5" /> Rejected
                    </button>
                    <button
                        onClick={() => submit("waitlisted")}
                        disabled={busy}
                        className="inline-flex items-center gap-1 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-400 ring-1 ring-inset ring-amber-500/30 hover:bg-amber-500/25 disabled:opacity-50"
                    >
                        <Hourglass className="h-3.5 w-3.5" /> Waitlisted
                    </button>
                    <button
                        onClick={onCancel}
                        disabled={busy}
                        className="inline-flex items-center gap-1 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-400 ring-1 ring-inset ring-white/10 hover:bg-white/10"
                    >
                        <X className="h-3.5 w-3.5" /> Cancel
                    </button>
                </div>
            </td>
        </tr>
    );
}

// Opened by clicking a recruit's name in the results table below (2026-09-04) - this
// REPLACES the old navigate-to-"/interview/[panelId]?recruit=..." Link entirely, so a lead
// can review/correct a recruit's review note/rating/interests without leaving this page.
// Completely separate from the Selected/Rejected/Waitlisted Fix flow (EditResultRow above) -
// this only ever touches the review fields on the recruit's interview token, never the
// logged result itself.
//
// Chrome mirrors EditRecruitModal's backdrop pattern exactly for visual consistency. Content
// is just the shared RecruitProfileCard, fed by a fetch-on-open against the recruit-detail
// endpoint - a 404 there shouldn't normally happen (a logged result implies a token exists)
// but is handled as a plain inline/toast error rather than left to crash the page.
function RecruitDetailModal({
    recruitId,
    subDomain,
    onClose,
}: {
    recruitId: string;
    subDomain: string;
    onClose: () => void;
}) {
    const [token, setToken] = useState<RecruitProfileCardToken | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Also used as RecruitProfileCard's onChanged - re-fetching this same endpoint refreshes
    // the "last saved by" line after a review save. It does not need to also refresh the
    // outer results list, since editing a review note doesn't change anything shown there.
    const load = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const res = await fetch(
                `/api/admin/recruitment/interview-results/recruit-detail?recruit_id=${recruitId}&sub_domain=${subDomain}`
            );
            const data = await res.json();
            if (res.ok) {
                setToken(data.data);
            } else {
                const message = data.error || "Could not load this recruit";
                setError(message);
                toast.error(message);
            }
        } catch {
            setError("Could not load this recruit");
            toast.error("Could not load this recruit");
        } finally {
            setLoading(false);
        }
    }, [recruitId, subDomain]);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="w-full max-w-lg border border-white/10 bg-black p-6 max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-4 flex items-center justify-between gap-3">
                    <h2 className="text-xl font-bold text-white">Recruit Profile</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="text-gray-400 transition hover:text-white"
                    >
                        <X className="h-5 w-5" />
                    </button>
                </div>

                {loading ? (
                    <div className="p-6 text-center text-sm text-gray-500">Loading...</div>
                ) : error || !token ? (
                    <div className="p-6 text-center text-sm text-red-400">{error || "Could not load this recruit"}</div>
                ) : (
                    <RecruitProfileCard token={token} onChanged={load} />
                )}
            </div>
        </div>
    );
}

// One collapsible section per domain - counts in the header so a lead can see at a glance
// how a domain's interviews went without opening it, and the table itself carries the
// existing Fix/edit flow unchanged (see EditResultRow above).
function DomainResultsSection({
    subDomain,
    rows,
    editingId,
    onEdit,
    onCancelEdit,
    onSaved,
    onOpenRecruit,
}: {
    subDomain: string;
    rows: InterviewResultRow[];
    editingId: string | null;
    onEdit: (id: string) => void;
    onCancelEdit: () => void;
    onSaved: () => void;
    onOpenRecruit: (recruitId: string, subDomain: string) => void;
}) {
    const [collapsed, setCollapsed] = useState(false);
    const counts = { selected: 0, rejected: 0, waitlisted: 0 };
    for (const r of rows) counts[r.result]++;

    return (
        <div className="border border-white/10 bg-black">
            <div className="flex flex-wrap items-center gap-2 px-5 py-4">
                <button
                    type="button"
                    onClick={() => setCollapsed((c) => !c)}
                    className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-3 text-left"
                >
                    <div className="flex min-w-0 items-center gap-2.5">
                        <ChevronDown className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
                        <h3 className="truncate text-sm font-bold text-white">{subDomainLabel(subDomain)}</h3>
                        <span className="shrink-0 text-xs font-medium text-gray-500">{subDomainSubsystem(subDomain)}</span>
                        <span className="shrink-0 text-xs text-gray-600">· {rows.length} interviewed</span>
                    </div>
                    <div className="flex shrink-0 flex-wrap items-center gap-1.5 text-xs">
                        {counts.selected > 0 && (
                            <span className="inline-flex items-center gap-1 bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
                                <Award className="h-3 w-3" /> {counts.selected}
                            </span>
                        )}
                        {counts.rejected > 0 && (
                            <span className="inline-flex items-center gap-1 bg-red-500/10 px-2 py-0.5 font-semibold text-red-400 ring-1 ring-inset ring-red-500/20">
                                <Ban className="h-3 w-3" /> {counts.rejected}
                            </span>
                        )}
                        {counts.waitlisted > 0 && (
                            <span className="inline-flex items-center gap-1 bg-amber-500/10 px-2 py-0.5 font-semibold text-amber-400 ring-1 ring-inset ring-amber-500/20">
                                <Hourglass className="h-3 w-3" /> {counts.waitlisted}
                            </span>
                        )}
                    </div>
                </button>
                {/* Restored 2026-09-04 - the export API (interview-results/export) was built
                    2026-09-03 but had no button left pointing at it after the interview page
                    rebuild. Same-origin GET with cookies, so a plain download link is enough -
                    no fetch/blob needed. Sibling of the collapse toggle, not nested in it
                    (nested interactive elements would both fire on one click). */}
                <a
                    href={`/api/admin/recruitment/interview-results/export?sub_domain=${subDomain}`}
                    download
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0 inline-flex items-center gap-1 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-gray-300 ring-1 ring-inset ring-white/10 transition hover:bg-white/10 hover:text-white"
                >
                    <Download className="h-3 w-3" /> Export CSV
                </a>
            </div>
            {!collapsed && (
                <div className="overflow-x-auto border-t border-white/10">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-white/10">
                                <th className="px-5 py-2.5">Name</th>
                                <th className="px-5 py-2.5">Result</th>
                                <th className="px-5 py-2.5">Notes</th>
                                <th className="px-5 py-2.5">Interviewer</th>
                                <th className="px-5 py-2.5">Decided</th>
                                <th className="px-5 py-2.5 text-right">Correct</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) =>
                                editingId === row.id ? (
                                    <EditResultRow key={row.id} row={row} onCancel={onCancelEdit} onSaved={onSaved} />
                                ) : (
                                    <tr key={row.id} className="border-b border-white/5 last:border-0">
                                        <td className="px-5 py-2.5">
                                            <div className="flex flex-wrap items-center gap-1.5">
                                                <button
                                                    type="button"
                                                    onClick={() => onOpenRecruit(row.recruit_id, row.sub_domain)}
                                                    title="View / edit profile"
                                                    className="font-medium text-white underline decoration-dotted decoration-gray-600 underline-offset-2 transition hover:text-red hover:decoration-red"
                                                >
                                                    {row.name}
                                                </button>
                                                {row.is_walkin && (
                                                    <span
                                                        title="Not shortlisted, let in as a walk-in"
                                                        className="inline-flex items-center gap-1 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-400 ring-1 ring-inset ring-amber-500/30"
                                                    >
                                                        <Footprints className="h-3 w-3" /> Walk-in
                                                    </span>
                                                )}
                                            </div>
                                            <div className="text-xs text-gray-500">{row.reg_no}</div>
                                        </td>
                                        <td className="px-5 py-2.5">
                                            <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold ring-1 ring-inset capitalize ${RESULT_STYLES[row.result]}`}>
                                                {row.result}
                                            </span>
                                        </td>
                                        <td className="px-5 py-2.5 max-w-[240px]">
                                            <span className="block truncate text-xs text-gray-400" title={row.notes ?? undefined}>
                                                {row.notes || "-"}
                                            </span>
                                        </td>
                                        <td className="px-5 py-2.5 text-gray-400 text-xs">{row.interviewer_username}</td>
                                        <td className="px-5 py-2.5 text-gray-400 text-xs">
                                            {row.decided_at ? new Date(row.decided_at).toLocaleString() : "-"}
                                        </td>
                                        <td className="px-5 py-2.5 text-right">
                                            <button
                                                onClick={() => onEdit(row.id)}
                                                className="inline-flex items-center gap-1 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-300 ring-1 ring-inset ring-white/10 hover:bg-white/10"
                                            >
                                                <Pencil className="h-3 w-3" /> Fix
                                            </button>
                                        </td>
                                    </tr>
                                )
                            )}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
}

function InterviewResultsList() {
    const [rows, setRows] = useState<InterviewResultRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingId, setEditingId] = useState<string | null>(null);
    // Which recruit's on-the-spot profile modal is open, if any - keyed by (recruit_id,
    // sub_domain) since a result row's identity for the recruit-detail endpoint is that pair,
    // not the result row's own id.
    const [openRecruit, setOpenRecruit] = useState<{ recruitId: string; subDomain: string } | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/recruitment/interview-results");
            const data = await res.json();
            if (res.ok) setRows(data.data ?? []);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const groups = groupResultsByDomain(rows);

    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
                <ClipboardList className="h-4 w-4 text-gray-400" />
                <h2 className="text-base font-bold text-white">Interview Results by Domain</h2>
                <span className="text-xs text-gray-500">({rows.length} total)</span>
            </div>
            {loading ? (
                <div className="border border-white/10 bg-black p-6 text-center text-sm text-gray-500">
                    Loading...
                </div>
            ) : rows.length === 0 ? (
                <div className="border border-white/10 bg-black p-6 text-center text-sm text-gray-500">
                    No results logged yet. They&apos;ll show up here as tables call recruits in.
                </div>
            ) : (
                <div className="space-y-3">
                    {groups.map((group) => (
                        <DomainResultsSection
                            key={group.sub_domain}
                            subDomain={group.sub_domain}
                            rows={group.rows}
                            editingId={editingId}
                            onEdit={setEditingId}
                            onCancelEdit={() => setEditingId(null)}
                            onSaved={() => {
                                setEditingId(null);
                                load();
                            }}
                            onOpenRecruit={(recruitId, subDomain) => setOpenRecruit({ recruitId, subDomain })}
                        />
                    ))}
                </div>
            )}
            {openRecruit && (
                <RecruitDetailModal
                    recruitId={openRecruit.recruitId}
                    subDomain={openRecruit.subDomain}
                    onClose={() => setOpenRecruit(null)}
                />
            )}
        </div>
    );
}

interface WaitingRecruit {
    token_id: string;
    token_number: number;
    checked_in_at: string;
    is_walkin: boolean;
    recruit: {
        id: string;
        name: string;
        reg_no: string;
        year: string;
        department: string;
        gender: string | null;
    } | null;
}

// "day/month, hour:minute" - matches the panel page's own copy, not worth sharing a module
// for one line.
function checkedInAtLabel(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString([], { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

// New 2026-09-04: read-only, cycle-wide view of who's currently checked in and waiting to be
// called - the same shared domain pool each [panelId] page's own "Waiting" list already shows
// live (see the 2026-09-04 migration-024 update above), surfaced here so a lead can see every
// domain's queue at a glance without opening a specific table. Reuses the existing
// waiting-by-domain endpoint directly - no new backend route needed, it already returns full
// recruit profiles. No "Call Here" action here on purpose: calling someone is a table's job,
// done from the [panelId] page where the interviewer actually is - this is a status board,
// not a control surface. No filters/analytics either (not asked for here, unlike Yet to Be
// Interviewed) - easy to add later the same way if wanted.
function WaitingForInterviewDomainSection({ subDomain }: { subDomain: RecruitSubDomain }) {
    const [collapsed, setCollapsed] = useState(true);
    const [rows, setRows] = useState<WaitingRecruit[]>([]);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/recruitment/panels/waiting-by-domain?sub_domain=${subDomain}`);
            const data = await res.json();
            if (res.ok) {
                setRows(data.data ?? []);
            } else {
                toast.error(data.error || `Could not load ${subDomainLabel(subDomain)}`);
            }
        } catch {
            toast.error(`Could not load ${subDomainLabel(subDomain)}`);
        } finally {
            setLoading(false);
        }
    }, [subDomain]);

    useEffect(() => {
        load();
    }, [load]);

    return (
        <div className="border border-white/10 bg-black">
            <div className="flex flex-wrap items-center gap-2 px-5 py-4">
                <button
                    type="button"
                    onClick={() => setCollapsed((c) => !c)}
                    className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5 text-left"
                >
                    <ChevronDown className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
                    <h3 className="truncate text-sm font-bold text-white">{subDomainLabel(subDomain)}</h3>
                    <span className="shrink-0 text-xs font-medium text-gray-500">{subDomainSubsystem(subDomain)}</span>
                    <span className="shrink-0 text-xs text-gray-600">· {loading ? "..." : rows.length} waiting</span>
                </button>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        load();
                    }}
                    disabled={loading}
                    title="Refresh"
                    className="shrink-0 inline-flex items-center gap-1 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-gray-300 ring-1 ring-inset ring-white/10 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                >
                    <RefreshCw className="h-3 w-3" /> Refresh
                </button>
            </div>
            {!collapsed && (
                <div className="border-t border-white/10">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500 text-sm">Loading...</div>
                    ) : rows.length === 0 ? (
                        <div className="p-8 text-center text-gray-500 text-sm">Nobody is waiting for this domain right now.</div>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-3">
                            {rows.map((r) => (
                                <div key={r.token_id} className="border border-white/10 bg-white/[0.02] p-3">
                                    <div className="flex items-center justify-between gap-2">
                                        <p className="truncate text-sm font-semibold text-white">
                                            #{r.token_number} · {r.recruit?.name ?? "Unknown"}
                                        </p>
                                        {r.is_walkin && (
                                            <span
                                                title="Not shortlisted, walk-in"
                                                className="shrink-0 inline-flex items-center gap-1 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-400 ring-1 ring-inset ring-amber-500/30"
                                            >
                                                <Footprints className="h-3 w-3" /> Walk-in
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-gray-500">{r.recruit?.reg_no}</p>
                                    <p className="mt-1 text-xs text-gray-400">
                                        {r.recruit ? `${recruitYearLabel(r.recruit.year)} · ${r.recruit.department}` : ""}
                                    </p>
                                    <p className="mt-1 text-xs text-gray-600">Waiting since {checkedInAtLabel(r.checked_in_at)}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

// Top-level cycle-wide list, mounted between InterviewResultsList and YetToBeInterviewedList
// per the user's explicit placement ask ("below Interview Results by Domain") - same
// one-section-per-domain pattern as its neighbors.
function WaitingForInterviewList() {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
                <Clock3 className="h-4 w-4 text-amber-400" />
                <h2 className="text-base font-bold text-white">Waiting for Interview</h2>
            </div>
            <div className="space-y-3">
                {RECRUIT_SUBDOMAINS.map((d) => (
                    <WaitingForInterviewDomainSection key={d.key} subDomain={d.key} />
                ))}
            </div>
        </div>
    );
}

interface YetToBeInterviewedRecruit {
    id: string;
    name: string;
    reg_no: string;
    year: string;
    gender: string | null;
    department: string;
    phone: string | null;
    is_hosteller: boolean;
    hostel_block: string | null;
    hostel_room: string | null;
    day_scholar_area: string | null;
    travel_method: string | null;
}

const YTI_GENDER_OPTIONS = [
    { value: "all", label: "All Genders" },
    ...GENDERS.map((g) => ({ value: g.key, label: g.label })),
];

const YTI_RESIDENCE_OPTIONS = [
    { value: "all", label: "All" },
    { value: "hosteller", label: "Hosteller" },
    { value: "day_scholar", label: "Day Scholar" },
];

const YTI_YEAR_OPTIONS = [
    { value: "all", label: "All Years" },
    ...RECRUIT_YEARS.map((y) => ({ value: y.key as string, label: y.label })),
];

// Recruits shortlisted for a domain who have never checked in for its interview at all - no
// token, so they're not in the waiting pool, not called, not done, not even a no-show.
// Cycle-wide (all six domains, one collapsible section each, in RECRUIT_SUBDOMAINS order) -
// this is deliberately independent of whichever domain the lead currently has selected in the
// step-1/2 picker above, since the point is to see who across the WHOLE cycle hasn't shown up
// yet, not just today's chosen domain. Each section fetches its own domain's data directly
// (the yet-to-be-interviewed endpoint is per sub_domain, unlike the all-domains-at-once
// interview-results endpoint InterviewResultsList uses) and carries its own gender/residence/
// year filters + the same gender x residence breakdown table pattern as the Shortlist page
// (ExamDomainsTab) - see that file's residenceStats/residenceGenderCols/residenceTotals for
// the shape this copies. Chrome mirrors DomainResultsSection's collapsible header exactly.
function YetToBeInterviewedDomainSection({ subDomain }: { subDomain: RecruitSubDomain }) {
    // Defaults closed (unlike DomainResultsSection's rows, which default open) - six of these
    // render at once here, one per domain, all fetching on mount, so starting collapsed keeps
    // the page from opening into a wall of six populated grids/tables at once.
    const [collapsed, setCollapsed] = useState(true);
    const [rows, setRows] = useState<YetToBeInterviewedRecruit[]>([]);
    const [loading, setLoading] = useState(true);
    const [genderFilter, setGenderFilter] = useState("all");
    const [residenceFilter, setResidenceFilter] = useState("all");
    const [yearFilter, setYearFilter] = useState("all");

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(
                `/api/admin/recruitment/interview-results/yet-to-be-interviewed?sub_domain=${subDomain}`
            );
            const data = await res.json();
            if (res.ok) {
                setRows(data.data ?? []);
            } else {
                toast.error(data.error || `Could not load ${subDomainLabel(subDomain)}`);
            }
        } catch {
            toast.error(`Could not load ${subDomainLabel(subDomain)}`);
        } finally {
            setLoading(false);
        }
    }, [subDomain]);

    // Slow-changing list (who has checked in doesn't move every few seconds like the live
    // queue views elsewhere on this page) - fetched once on mount, plus a manual refresh
    // button, rather than the 5s polling used for panel counts.
    useEffect(() => {
        load();
    }, [load]);

    const visibleRows = useMemo(() => {
        let list = rows;
        if (genderFilter !== "all") list = list.filter((r) => r.gender === genderFilter);
        if (residenceFilter !== "all") {
            list = list.filter((r) => (residenceFilter === "hosteller" ? r.is_hosteller : !r.is_hosteller));
        }
        if (yearFilter !== "all") list = list.filter((r) => r.year === yearFilter);
        return list;
    }, [rows, genderFilter, residenceFilter, yearFilter]);

    const residenceStats = useMemo(() => {
        const empty = () => ({ hosteller: 0, dayScholar: 0 });
        const buckets = { male: empty(), female: empty(), unspecified: empty() };
        for (const r of visibleRows) {
            const key = r.gender === "male" ? "male" : r.gender === "female" ? "female" : "unspecified";
            if (r.is_hosteller) buckets[key].hosteller += 1;
            else buckets[key].dayScholar += 1;
        }
        return buckets;
    }, [visibleRows]);

    const residenceHasUnspecified =
        residenceStats.unspecified.hosteller + residenceStats.unspecified.dayScholar > 0;
    const residenceGenderCols = [
        { key: "male" as const, label: "Male" },
        { key: "female" as const, label: "Female" },
        ...(residenceHasUnspecified ? [{ key: "unspecified" as const, label: "Unspecified" }] : []),
    ];
    const residenceTotals = {
        hosteller: residenceStats.male.hosteller + residenceStats.female.hosteller + residenceStats.unspecified.hosteller,
        dayScholar: residenceStats.male.dayScholar + residenceStats.female.dayScholar + residenceStats.unspecified.dayScholar,
    };

    return (
        <div className="border border-white/10 bg-black">
            <div className="flex flex-wrap items-center gap-2 px-5 py-4">
                <button
                    type="button"
                    onClick={() => setCollapsed((c) => !c)}
                    className="flex min-w-0 flex-1 flex-wrap items-center gap-2.5 text-left"
                >
                    <ChevronDown className={`h-4 w-4 shrink-0 text-gray-500 transition-transform ${collapsed ? "-rotate-90" : ""}`} />
                    <h3 className="truncate text-sm font-bold text-white">{subDomainLabel(subDomain)}</h3>
                    <span className="shrink-0 text-xs font-medium text-gray-500">{subDomainSubsystem(subDomain)}</span>
                    <span className="shrink-0 text-xs text-gray-600">· {loading ? "..." : rows.length} pending</span>
                </button>
                <button
                    type="button"
                    onClick={(e) => {
                        e.stopPropagation();
                        load();
                    }}
                    disabled={loading}
                    title="Refresh"
                    className="shrink-0 inline-flex items-center gap-1 bg-white/5 px-2.5 py-1.5 text-[11px] font-semibold text-gray-300 ring-1 ring-inset ring-white/10 transition hover:bg-white/10 hover:text-white disabled:opacity-50"
                >
                    <RefreshCw className="h-3 w-3" /> Refresh
                </button>
            </div>
            {!collapsed && (
                <div className="border-t border-white/10 p-4 space-y-3">
                    <div className="flex flex-wrap gap-3">
                        <div className="w-40">
                            <Select
                                accent="blue"
                                value={genderFilter}
                                onChange={setGenderFilter}
                                className="h-10 bg-white/5 ring-white/10 py-0 px-3 text-sm"
                                options={YTI_GENDER_OPTIONS}
                            />
                        </div>
                        <div className="w-36">
                            <Select
                                accent="blue"
                                value={residenceFilter}
                                onChange={setResidenceFilter}
                                className="h-10 bg-white/5 ring-white/10 py-0 px-3 text-sm"
                                options={YTI_RESIDENCE_OPTIONS}
                            />
                        </div>
                        <div className="w-36">
                            <Select
                                accent="blue"
                                value={yearFilter}
                                onChange={setYearFilter}
                                className="h-10 bg-white/5 ring-white/10 py-0 px-3 text-sm"
                                options={YTI_YEAR_OPTIONS}
                            />
                        </div>
                    </div>

                    {!loading && visibleRows.length > 0 && (
                        <div className="border border-white/10 bg-black p-4">
                            <h4 className="text-xs font-bold uppercase tracking-widest text-gray-500">
                                Residence Breakdown
                                <span className="ml-2 normal-case font-normal text-gray-600">
                                    ({visibleRows.length} in view, matching the filters above)
                                </span>
                            </h4>
                            <div className="overflow-x-auto mt-3">
                                <table className="text-sm">
                                    <thead>
                                        <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b border-white/10">
                                            <th className="pr-8 py-2" />
                                            {residenceGenderCols.map((g) => (
                                                <th key={g.key} className="px-4 py-2 text-right">
                                                    {g.label}
                                                </th>
                                            ))}
                                            <th className="pl-4 py-2 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr className="border-b border-white/5">
                                            <td className="pr-8 py-2 text-gray-300">Hosteller</td>
                                            {residenceGenderCols.map((g) => (
                                                <td key={g.key} className="px-4 py-2 text-right text-gray-200">
                                                    {residenceStats[g.key].hosteller}
                                                </td>
                                            ))}
                                            <td className="pl-4 py-2 text-right text-white font-semibold">{residenceTotals.hosteller}</td>
                                        </tr>
                                        <tr>
                                            <td className="pr-8 py-2 text-gray-300">Day Scholar</td>
                                            {residenceGenderCols.map((g) => (
                                                <td key={g.key} className="px-4 py-2 text-right text-gray-200">
                                                    {residenceStats[g.key].dayScholar}
                                                </td>
                                            ))}
                                            <td className="pl-4 py-2 text-right text-white font-semibold">{residenceTotals.dayScholar}</td>
                                        </tr>
                                        <tr className="border-t border-white/10">
                                            <td className="pr-8 py-2 text-gray-500">Total</td>
                                            {residenceGenderCols.map((g) => (
                                                <td key={g.key} className="px-4 py-2 text-right text-gray-500">
                                                    {residenceStats[g.key].hosteller + residenceStats[g.key].dayScholar}
                                                </td>
                                            ))}
                                            <td className="pl-4 py-2 text-right text-gray-400 font-semibold">
                                                {residenceTotals.hosteller + residenceTotals.dayScholar}
                                            </td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    <div className="border border-white/10 bg-black">
                        {loading ? (
                            <div className="p-8 text-center text-gray-500 text-sm">Loading...</div>
                        ) : rows.length === 0 ? (
                            <div className="p-8 text-center text-gray-500 text-sm">
                                Everyone shortlisted for this domain has checked in.
                            </div>
                        ) : visibleRows.length === 0 ? (
                            <div className="p-8 text-center text-gray-500 text-sm">No recruits match these filters.</div>
                        ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 p-3">
                                {visibleRows.map((r) => (
                                    <div key={r.id} className="border border-white/10 bg-white/[0.02] p-3">
                                        <div className="flex items-center justify-between gap-2">
                                            <p className="truncate text-sm font-semibold text-white">{r.name}</p>
                                            {r.gender && (
                                                <span className="shrink-0 inline-flex items-center bg-blue-500/10 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-400 ring-1 ring-inset ring-blue-500/20">
                                                    {genderLabel(r.gender)}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-gray-500">{r.reg_no}</p>
                                        <p className="mt-1 text-xs text-gray-400">
                                            {recruitYearLabel(r.year)} · {r.department}
                                        </p>
                                        <p className="mt-1 text-xs text-gray-500">
                                            {r.is_hosteller
                                                ? `Hosteller${r.hostel_block ? ` · ${r.hostel_block}` : ""}`
                                                : ["Day Scholar", r.day_scholar_area, travelMethodLabel(r.travel_method)]
                                                      .filter(Boolean)
                                                      .join(" · ")}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

// Top-level cycle-wide list, mounted below InterviewResultsList - all six domains at once,
// each as its own self-fetching collapsible section (see YetToBeInterviewedDomainSection
// above), rather than scoped to whatever domain happens to be selected in the picker.
function YetToBeInterviewedList() {
    return (
        <div className="space-y-4">
            <div className="flex items-center gap-2 px-1">
                <Users className="h-4 w-4 text-gray-400" />
                <h2 className="text-base font-bold text-white">Yet to Be Interviewed</h2>
            </div>
            <div className="space-y-3">
                {RECRUIT_SUBDOMAINS.map((d) => (
                    <YetToBeInterviewedDomainSection key={d.key} subDomain={d.key} />
                ))}
            </div>
        </div>
    );
}

export default function InterviewManagementPage() {
    const ready = useRequireRole(["member", "lead", "admin"]);
    const router = useRouter();
    const [panels, setPanels] = useState<Panel[]>([]);
    // Domain-wide waiting counts (migration 024 - waiting recruits belong to the domain's
    // shared pool, not any specific table, so this can't be summed from panel.counts.waiting
    // any more). Sibling state, keyed by sub_domain, from the same /panels response.
    const [waitingByDomain, setWaitingByDomain] = useState<Record<string, number>>({});
    const [loading, setLoading] = useState(true);
    const [noCycle, setNoCycle] = useState(false);
    const [selectedDomain, setSelectedDomain] = useState<RecruitSubDomain | null>(null);

    const loadPanels = useCallback(async (): Promise<Panel[]> => {
        try {
            const res = await fetch("/api/admin/recruitment/panels");
            const data = await res.json();
            if (res.ok) {
                setNoCycle(false);
                const list: Panel[] = data.data ?? [];
                setPanels(list);
                setWaitingByDomain(data.waiting_by_domain ?? {});
                return list;
            } else if (res.status === 503) {
                setNoCycle(true);
            } else {
                toast.error(data.error || "Could not load panels");
            }
        } finally {
            setLoading(false);
        }
        return [];
    }, []);

    // Only the panel list is polled here (no per-panel queue fetches) - this page never
    // shows queue contents, just table counts, so there's nothing else to fetch every 5s.
    useEffect(() => {
        if (!ready) return;
        loadPanels();
        const interval = setInterval(loadPanels, 5000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready]);

    // AddPanelForm's onCreated takes no arguments and its submit logic isn't ours to touch,
    // so the freshly created panel's id is recovered by diffing this domain's active panel
    // ids before and after the refetch it triggers - whichever id is new is the one just
    // created. Safe even if someone else opens a table for the same domain in that instant,
    // since only a genuinely new id qualifies.
    const handlePanelCreated = useCallback(async () => {
        const beforeIds = new Set(
            panels.filter((p) => p.sub_domain === selectedDomain && p.is_active).map((p) => p.id)
        );
        const list = await loadPanels();
        const created = list.find((p) => p.sub_domain === selectedDomain && p.is_active && !beforeIds.has(p.id));
        if (created) {
            router.push(`/dashboard/recruitment/interview/${created.id}`);
        }
    }, [panels, selectedDomain, loadPanels, router]);

    if (!ready) return null;

    const subsystemGroups = groupBySubsystem();

    // How many tables are open (client-side from the panel list already being polled), plus
    // the domain-wide waiting count from the server (migration 024 - waiting recruits sit in
    // one shared pool per domain, not attached to any specific table, so this can't be
    // summed from individual panels any more).
    const domainSummary = (key: string) => {
        const domainPanels = panels.filter((p) => p.sub_domain === key);
        return {
            open: domainPanels.filter((p) => p.is_active).length,
            waiting: waitingByDomain[key] ?? 0,
        };
    };

    // Includes paused panels too (2026-09-04 fix) - they used to be filtered out entirely,
    // which meant pausing a table was a one-way trip: it vanished from this list with no way
    // back to it, even though PATCH .../reopen already existed server-side. Active panels
    // sort first so the tables actually usable right now aren't buried below paused ones.
    const panelsForDomain = selectedDomain
        ? panels
              .filter((p) => p.sub_domain === selectedDomain)
              .sort((a, b) => Number(b.is_active) - Number(a.is_active))
        : [];

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                    <Radio className="w-7 h-7 text-red" />
                    Interview Day
                </h1>
                <p className="mt-2 text-gray-400 text-sm max-w-xl">
                    Pick a domain, then join an open table or start a new one. Walk-in, no time slots.
                </p>
            </div>

            {noCycle ? (
                <div className="border border-amber-500/30 bg-black p-6 text-sm text-amber-300">
                    No active recruitment cycle. Start one from Cycles before opening interview panels.
                </div>
            ) : loading ? (
                <div className="p-8 text-center text-gray-500 text-sm">Loading domains...</div>
            ) : !selectedDomain ? (
                <div className="space-y-6">
                    {subsystemGroups.map((group) => (
                        <div key={group.subsystem} className="space-y-3">
                            <h2 className="text-xs font-black uppercase tracking-widest text-red">{group.subsystem}</h2>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {group.domains.map((d) => {
                                    const summary = domainSummary(d.key);
                                    return (
                                        <button
                                            key={d.key}
                                            type="button"
                                            onClick={() => setSelectedDomain(d.key)}
                                            className="border border-white/10 bg-black p-4 text-left transition hover:border-red/40 hover:bg-red/[0.04]"
                                        >
                                            <h3 className="text-base font-bold text-white">{d.label}</h3>
                                            <div className="mt-2 flex flex-wrap gap-1.5 text-[11px]">
                                                <span className="inline-flex items-center gap-1 bg-white/5 px-1.5 py-0.5 font-semibold text-gray-300 ring-1 ring-inset ring-white/10">
                                                    {summary.open} table{summary.open === 1 ? "" : "s"} open
                                                </span>
                                                <span className="inline-flex items-center gap-1 bg-amber-500/10 px-1.5 py-0.5 font-semibold text-amber-400 ring-1 ring-inset ring-amber-500/20">
                                                    <Clock3 className="h-3 w-3" /> {summary.waiting} waiting
                                                </span>
                                            </div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>
            ) : (
                <div className="space-y-4">
                    <div>
                        <button
                            type="button"
                            onClick={() => setSelectedDomain(null)}
                            className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 transition hover:text-white"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" /> All domains
                        </button>
                        <h2 className="mt-1 text-xl font-black text-white">{subDomainFullLabel(selectedDomain)}</h2>
                    </div>

                    <div className="space-y-3">
                        {panelsForDomain.length === 0 && (
                            <div className="border border-white/10 bg-black p-5 text-center text-xs text-gray-500">
                                No tables for this domain yet.
                            </div>
                        )}
                        {panelsForDomain.map((p) => (
                            <div key={p.id} className="space-y-1.5">
                                <PanelCard panel={p} onChanged={loadPanels} />
                                {p.is_active ? (
                                    <button
                                        type="button"
                                        onClick={() => router.push(`/dashboard/recruitment/interview/${p.id}`)}
                                        className="w-full inline-flex items-center justify-center gap-2 bg-red/15 px-4 py-2 text-sm font-bold text-red ring-1 ring-inset ring-red/40 transition hover:bg-red/25"
                                    >
                                        <PhoneCall className="h-4 w-4" /> Join This Table
                                    </button>
                                ) : (
                                    <p className="text-center text-[11px] text-gray-600">
                                        Paused - Resume above to join it again
                                    </p>
                                )}
                            </div>
                        ))}
                    </div>

                    <div>
                        <p className="mb-2 text-[11px] font-bold uppercase tracking-widest text-gray-500">Or start a new table</p>
                        <AddPanelForm subDomain={selectedDomain} onCreated={handlePanelCreated} />
                    </div>
                </div>
            )}

            {!noCycle && <InterviewResultsList />}
            {!noCycle && <WaitingForInterviewList />}
            {!noCycle && <YetToBeInterviewedList />}
        </div>
    );
}
