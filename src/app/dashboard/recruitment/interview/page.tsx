"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
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

    return { busy, closePanel, closeForDay, deletePanel };
}

// Compact summary card for one table (name, counts, its own Pause/Close/Delete). Used here
// for the "choose an existing open table" list in step 2 - a separate "Join This Table"
// button sits below each card (see the page component) rather than making the whole card
// clickable, so a Pause/Delete click here can never also be read as "join".
function PanelCard({ panel, onChanged }: { panel: Panel; onChanged: () => void }) {
    const { busy, closePanel, closeForDay, deletePanel } = usePanelActions(panel, onChanged);

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
                {panel.is_active && (
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
}: {
    subDomain: string;
    rows: InterviewResultRow[];
    editingId: string | null;
    onEdit: (id: string) => void;
    onCancelEdit: () => void;
    onSaved: () => void;
}) {
    const [collapsed, setCollapsed] = useState(false);
    const counts = { selected: 0, rejected: 0, waitlisted: 0 };
    for (const r of rows) counts[r.result]++;

    return (
        <div className="border border-white/10 bg-black">
            <button
                type="button"
                onClick={() => setCollapsed((c) => !c)}
                className="flex w-full flex-wrap items-center justify-between gap-3 px-5 py-4 text-left transition hover:bg-white/[0.02]"
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
                                                {row.panel_id ? (
                                                    <Link
                                                        href={`/dashboard/recruitment/interview/${row.panel_id}?recruit=${row.recruit_id}`}
                                                        title={row.panel_label ? `Go to ${row.panel_label}` : "Go to this recruit's panel"}
                                                        className="font-medium text-white underline decoration-dotted decoration-gray-600 underline-offset-2 transition hover:text-red hover:decoration-red"
                                                    >
                                                        {row.name}
                                                    </Link>
                                                ) : (
                                                    <span className="font-medium text-white">{row.name}</span>
                                                )}
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
                        />
                    ))}
                </div>
            )}
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

    const activePanelsForDomain = selectedDomain
        ? panels.filter((p) => p.sub_domain === selectedDomain && p.is_active)
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
                        {activePanelsForDomain.length === 0 && (
                            <div className="border border-white/10 bg-black p-5 text-center text-xs text-gray-500">
                                No tables open yet for this domain.
                            </div>
                        )}
                        {activePanelsForDomain.map((p) => (
                            <div key={p.id} className="space-y-1.5">
                                <PanelCard panel={p} onChanged={loadPanels} />
                                <button
                                    type="button"
                                    onClick={() => router.push(`/dashboard/recruitment/interview/${p.id}`)}
                                    className="w-full inline-flex items-center justify-center gap-2 bg-red/15 px-4 py-2 text-sm font-bold text-red ring-1 ring-inset ring-red/40 transition hover:bg-red/25"
                                >
                                    <PhoneCall className="h-4 w-4" /> Join This Table
                                </button>
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
        </div>
    );
}
