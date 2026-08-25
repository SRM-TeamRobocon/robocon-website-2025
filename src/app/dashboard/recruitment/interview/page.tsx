"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
    Radio,
    Plus,
    Users,
    PhoneCall,
    CheckCircle2,
    Clock3,
    UserX,
    Award,
    Star,
    Ban,
    Hourglass,
    Trash2,
    ClipboardList,
    Pencil,
    X,
    GripVertical,
    Footprints,
    ChevronDown,
} from "lucide-react";
import {
    DndContext,
    closestCenter,
    PointerSensor,
    useSensor,
    useSensors,
    type DragEndEvent,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable, arrayMove } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRequireRole } from "@/hooks/use-require-role";

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

interface RecruitProfile {
    id: string;
    name: string;
    reg_no: string;
    year: string;
    department: string;
    domains: string[];
    exam_marks: { sub_domain: string; marks: number }[];
    portfolio_url?: string;
    shortlisted_for: string[];
    is_hosteller: boolean;
    hostel_block: string | null;
    day_scholar_area: string | null;
    travel_method: string | null;
    gender: string | null;
}

interface QueueToken {
    token_id: string;
    token_number: number;
    queue_position: number;
    status: TokenStatus;
    recruit: RecruitProfile;
    checked_in_at: string;
    called_at?: string;
    is_walkin: boolean;
}

import {
    RECRUIT_SUBDOMAINS,
    subDomainLabel,
    subDomainFullLabel,
    subDomainSubsystem,
    groupBySubsystem,
    type RecruitSubDomain,
} from "@/lib/recruit-domains";
import { travelMethodLabel } from "@/lib/travel-method";
import { genderLabel } from "@/lib/gender";

// Scoped to a single, already-known sub_domain — every call site now lives inside that
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

// Shared by TableSlot's own control strip (open tables) and PanelCard (closed tables /
// legacy no-domain panels) — one place for the Pause / Close-for-Day / Delete network
// calls so the two presentations can't drift apart.
function usePanelActions(panel: Panel, onChanged: () => void) {
    const [busy, setBusy] = useState(false);

    // Reversible pause — Reopen brings back any stranded `waiting` tokens exactly as they
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

    // Hard delete — drops the panel row entirely. Waiting recruits are redistributed just
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

// Compact action strip for an OPEN table's own slot card.
function TableControls({ panel, onChanged }: { panel: Panel; onChanged: () => void }) {
    const { busy, closePanel, closeForDay, deletePanel } = usePanelActions(panel, onChanged);
    return (
        <div className="flex shrink-0 flex-wrap gap-1.5">
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
                Close Day
            </button>
            <button
                onClick={deletePanel}
                disabled={busy}
                title={`Delete ${panel.domain_label} table`}
                className="inline-flex items-center gap-1 bg-red-500/10 px-2.5 py-1 text-[11px] font-semibold text-red-400 ring-1 ring-inset ring-red-500/30 transition hover:bg-red-500/25 disabled:opacity-50"
            >
                <Trash2 className="h-3 w-3" />
            </button>
        </div>
    );
}

// Read-only-ish fallback card: counts + status alongside Pause/Close-for-Day/Delete,
// without the full call/interview flow. Used for a sub-domain row's own CLOSED tables,
// and for any legacy panel with no sub_domain at all (pre-2026-08-13 free-text panels) —
// the new subsystem-column layout groups strictly by sub_domain, so a null-domain panel
// has nowhere else to render; without this fallback it would be invisible and
// unmanageable (can't Pause/Close/Delete it) even though its row in the DB still exists.
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
                    <span className="inline-flex items-center gap-1 bg-amber-500/10 px-1.5 py-0.5 font-semibold text-amber-400 ring-1 ring-inset ring-amber-500/20">
                        <Clock3 className="h-3 w-3" /> {panel.counts.waiting}
                    </span>
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

function RecruitProfileCard({ token }: { token: QueueToken }) {
    const r = token.recruit;
    return (
        <div className="border border-white/10 bg-black/30 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <div className="flex flex-wrap items-center gap-2">
                        <p className="text-lg font-black text-white">
                            #{token.token_number} · {r.name}
                        </p>
                        {token.is_walkin && (
                            <span className="inline-flex items-center gap-1 bg-amber-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-400 ring-1 ring-inset ring-amber-500/30">
                                <Footprints className="h-3 w-3" /> Walk-in
                            </span>
                        )}
                    </div>
                    <p className="text-sm text-gray-400">
                        {r.reg_no} · Year {r.year} · {r.department}
                        {r.gender ? ` · ${genderLabel(r.gender)}` : ""}
                    </p>
                    <p className="mt-1 text-sm text-gray-400">
                        {r.is_hosteller
                            ? `Hosteller${r.hostel_block ? ` · ${r.hostel_block}` : ""}`
                            : ["Day Scholar", r.day_scholar_area, travelMethodLabel(r.travel_method)].filter(Boolean).join(" · ")}
                    </p>
                    {token.is_walkin && (
                        <p className="mt-1 text-xs text-amber-400/80">
                            Not shortlisted for this domain, let in as a walk-in on interview day.
                        </p>
                    )}
                </div>
                {r.portfolio_url && (
                    <a
                        href={r.portfolio_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 bg-blue-500/15 px-3 py-1.5 text-xs font-semibold text-blue-400 ring-1 ring-inset ring-blue-500/30 transition hover:bg-blue-500/25"
                    >
                        LinkedIn ↗
                    </a>
                )}
            </div>

            <div>
                <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">Applied for</p>
                <div className="flex flex-wrap gap-1.5">
                    {r.domains.map((d) => (
                        <span
                            key={d}
                            className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-semibold ring-1 ring-inset ${
                                r.shortlisted_for.includes(d)
                                    ? "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30"
                                    : "bg-white/5 text-gray-400 ring-white/10"
                            }`}
                        >
                            {r.shortlisted_for.includes(d) && <Star className="h-3 w-3" />}
                            {subDomainLabel(d)}
                        </span>
                    ))}
                    {r.domains.length === 0 && <span className="text-xs text-gray-500">—</span>}
                </div>
            </div>

            {r.exam_marks.length > 0 && (
                <div>
                    <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">Exam marks</p>
                    <div className="flex flex-wrap gap-1.5">
                        {r.exam_marks.map((m) => (
                            <span
                                key={m.sub_domain}
                                className="bg-white/5 px-2 py-1 text-xs font-semibold text-gray-300 ring-1 ring-inset ring-white/10"
                            >
                                {subDomainLabel(m.sub_domain)}: {m.marks}
                            </span>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}

// One OPEN table's own card: its "Now Serving" slot (centerpiece: recruit name + this
// table's own display name, per the exact ask), its own Call Next (front of ITS OWN
// queue_position-ordered waiting list — unchanged FIFO behaviour), result logging, and
// its Pause/Close/Delete controls. Manual cross-table calling into this slot happens
// from SharedWaitingQueue below, not here — both actions land the same recruit in the
// same "called" slot either way.
function TableSlot({ panel, tokens, onChanged }: { panel: Panel; tokens: QueueToken[]; onChanged: () => void }) {
    const called = tokens.find((t) => t.status === "called") ?? null;
    const waitingCount = tokens.filter((t) => t.status === "waiting").length;
    const [notes, setNotes] = useState("");
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!called) setNotes("");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [called?.token_id]);

    const callNext = async () => {
        setBusy(true);
        try {
            const res = await fetch(`/api/admin/recruitment/panels/${panel.id}/call-next`, { method: "POST" });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "Could not call next recruit");
            } else if (data.status === "queue_empty") {
                toast("Queue is empty", { icon: "📭" });
            } else {
                toast.success(`Called #${data.token_number}: ${data.recruit?.name ?? ""}`);
            }
        } finally {
            setBusy(false);
            onChanged();
        }
    };

    const logResult = async (result: "selected" | "rejected" | "waitlisted") => {
        if (!called) return;
        if (!panel.sub_domain) {
            toast.error("This table has no domain set, cannot log a result");
            return;
        }
        setBusy(true);
        try {
            const res = await fetch("/api/admin/recruitment/interview-results", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    recruit_id: called.recruit.id,
                    sub_domain: panel.sub_domain,
                    result,
                    notes: notes.trim() || undefined,
                    panel_id: panel.id,
                }),
            });
            const data = await res.json();
            if (res.ok && data.saved) {
                toast.success(`Logged: ${result}`);
                setNotes("");
            } else {
                toast.error(data.error || "Could not log result");
            }
        } finally {
            setBusy(false);
            onChanged();
        }
    };

    const markNoShow = async () => {
        if (!called) return;
        if (!confirm(`Mark #${called.token_number}: ${called.recruit.name} as no-show?`)) return;
        setBusy(true);
        try {
            const res = await fetch(`/api/admin/recruitment/panels/tokens/${called.token_id}/no-show`, {
                method: "PATCH",
            });
            const data = await res.json();
            if (res.ok && data.no_show) {
                toast.success("Marked no-show");
            } else {
                toast.error(data.error || "Could not mark no-show");
            }
        } finally {
            setBusy(false);
            onChanged();
        }
    };

    return (
        <div className="border border-white/10 bg-black p-4 space-y-3">
            <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                    <h3 className="truncate font-bold text-white">{panel.domain_label}</h3>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                        <span className="inline-flex items-center gap-1 bg-amber-500/10 px-1.5 py-0.5 font-semibold text-amber-400 ring-1 ring-inset ring-amber-500/20">
                            <Clock3 className="h-3 w-3" /> {panel.counts.waiting} waiting
                        </span>
                        <span className="inline-flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" /> {panel.counts.done} done
                        </span>
                    </div>
                </div>
                <TableControls panel={panel} onChanged={onChanged} />
            </div>

            {called ? (
                <div className="border border-blue-500/30 bg-blue-500/[0.06] p-4 space-y-3">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-400">
                        <PhoneCall className="h-4 w-4" /> Now Serving
                    </div>
                    {/* Centerpiece per the exact ask: recruit name + this table's display
                        name, front and center above the fuller profile detail. */}
                    <div className="text-center py-1">
                        <p className="text-2xl font-black text-white leading-tight">{called.recruit.name}</p>
                        <p className="mt-1 text-xs font-bold uppercase tracking-widest text-blue-400">{panel.domain_label}</p>
                    </div>
                    <RecruitProfileCard token={called} />

                    <div className="space-y-3">
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Optional notes..."
                            rows={2}
                            className="w-full border-0 bg-white/5 py-2 px-3 text-sm text-white placeholder:text-gray-500 ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => logResult("selected")}
                                disabled={busy || !panel.sub_domain}
                                className="inline-flex items-center gap-1.5 bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/30 transition hover:bg-emerald-500/25 disabled:opacity-50"
                            >
                                <Award className="h-4 w-4" /> Selected
                            </button>
                            <button
                                onClick={() => logResult("rejected")}
                                disabled={busy || !panel.sub_domain}
                                className="inline-flex items-center gap-1.5 bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-400 ring-1 ring-inset ring-red-500/30 transition hover:bg-red-500/25 disabled:opacity-50"
                            >
                                <Ban className="h-4 w-4" /> Rejected
                            </button>
                            <button
                                onClick={() => logResult("waitlisted")}
                                disabled={busy || !panel.sub_domain}
                                className="inline-flex items-center gap-1.5 bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-400 ring-1 ring-inset ring-amber-500/30 transition hover:bg-amber-500/25 disabled:opacity-50"
                            >
                                <Hourglass className="h-4 w-4" /> Waitlisted
                            </button>
                            <button
                                onClick={markNoShow}
                                disabled={busy}
                                className="inline-flex items-center gap-1.5 bg-white/5 px-4 py-2 text-sm font-semibold text-gray-400 ring-1 ring-inset ring-white/10 transition hover:bg-white/10 ml-auto"
                            >
                                <UserX className="h-4 w-4" /> No Show
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <button
                    onClick={callNext}
                    disabled={busy || waitingCount === 0}
                    className="group relative w-full overflow-hidden inline-flex items-center justify-center bg-red px-6 py-2.5 text-sm font-bold text-white shadow-lg shadow-red/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-red/40 active:translate-y-0 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:pointer-events-none"
                    style={{ clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)" }}
                >
                    <span
                        className="absolute inset-0 -translate-x-full transition-transform duration-200 ease-out group-hover:translate-x-0"
                        style={{ clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)", backgroundColor: "#D4AF37" }}
                    />
                    <span className="relative inline-flex items-center gap-2 transition-colors duration-200 group-hover:text-black">
                        <PhoneCall className="h-4 w-4" /> Call Next
                    </span>
                </button>
            )}
        </div>
    );
}

// One row inside the shared, per-sub-domain waiting queue. Shows which table currently
// holds this recruit's token isn't rendered here (grouping headers above do that job in
// SharedWaitingQueue) — this row's own job is the recruit summary plus one "Call to X"
// button per currently open table, so an interviewer at ANY table in this sub-domain can
// pull this recruit to their own desk regardless of which table they checked into.
function SortableSharedRow({
    token,
    openPanels,
    onCall,
    callingId,
}: {
    token: QueueToken;
    openPanels: Panel[];
    onCall: (targetPanelId: string, tokenId: string) => void;
    callingId: string | null;
}) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: token.token_id,
    });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };

    return (
        <div
            ref={setNodeRef}
            style={style}
            className="flex flex-wrap items-center gap-2 border border-white/10 bg-black/20 px-3 py-2.5"
        >
            <button
                type="button"
                {...attributes}
                {...listeners}
                className="shrink-0 cursor-grab touch-none text-gray-500 transition hover:text-white active:cursor-grabbing"
                aria-label="Drag to reorder"
            >
                <GripVertical className="h-4 w-4" />
            </button>
            <span className="w-10 shrink-0 font-mono text-sm text-gray-300">#{token.token_number}</span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">{token.recruit.name}</span>
            {token.is_walkin && (
                <span
                    title="Not shortlisted — walk-in"
                    className="shrink-0 inline-flex items-center gap-1 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-400 ring-1 ring-inset ring-amber-500/30"
                >
                    <Footprints className="h-3 w-3" /> Walk-in
                </span>
            )}
            <span className="shrink-0 text-xs text-gray-500">{token.recruit.reg_no}</span>
            <div className="flex shrink-0 flex-wrap gap-1">
                {openPanels.map((p) => (
                    <button
                        key={p.id}
                        type="button"
                        onClick={() => onCall(p.id, token.token_id)}
                        disabled={callingId === token.token_id}
                        title={`Call to ${p.domain_label}`}
                        className="inline-flex items-center gap-1 bg-red/15 px-2 py-1 text-[11px] font-semibold text-red ring-1 ring-inset ring-red/40 transition hover:bg-red/25 disabled:opacity-50"
                    >
                        <PhoneCall className="h-3 w-3" /> {p.domain_label}
                    </button>
                ))}
            </div>
        </div>
    );
}

// ONE shared waiting list for the whole sub-domain, combining every currently open
// table's `waiting` tokens — the core of the manual, cross-table calling model. Grouped
// visually by table (with a sub-header) rather than flattened into one global order,
// because the drag-reorder endpoint is scoped to a single panel_id: it can only place a
// token relative to OTHER waiting tokens on that SAME panel, so a per-table DndContext
// keeps every drag operation valid by construction — a token can never be dragged into
// another table's queue (that's what the "Call to X" buttons are for instead).
function SharedWaitingQueue({
    subDomain,
    openPanels,
    tokensByPanel,
    loading,
    onChanged,
}: {
    subDomain: string;
    openPanels: Panel[];
    tokensByPanel: Record<string, QueueToken[]>;
    loading: boolean;
    onChanged: () => void;
}) {
    const [callingId, setCallingId] = useState<string | null>(null);
    const dragSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const groups = openPanels.map((p) => ({
        panel: p,
        waiting: (tokensByPanel[p.id] ?? []).filter((t) => t.status === "waiting"),
    }));
    const totalWaiting = groups.reduce((n, g) => n + g.waiting.length, 0);

    const callToken = async (targetPanelId: string, tokenId: string) => {
        setCallingId(tokenId);
        try {
            const res = await fetch(`/api/admin/recruitment/panels/${targetPanelId}/call-token`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token_id: tokenId }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(`Called #${data.token_number} — ${data.recruit?.name ?? ""}`);
            } else {
                toast.error(data.error || "Could not call this recruit");
            }
        } finally {
            setCallingId(null);
            onChanged();
        }
    };

    const makeDragEndHandler = (panelId: string, waiting: QueueToken[]) => async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = waiting.findIndex((t) => t.token_id === active.id);
        const newIndex = waiting.findIndex((t) => t.token_id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;

        const reordered = arrayMove(waiting, oldIndex, newIndex);
        const movedToken = reordered[newIndex];
        const afterToken = newIndex > 0 ? reordered[newIndex - 1] : null;

        try {
            const res = await fetch(
                `/api/admin/recruitment/panels/${panelId}/tokens/${movedToken.token_id}/reorder`,
                {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ after_token_id: afterToken ? afterToken.token_id : null }),
                }
            );
            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                toast.error(data.error || "Could not reorder queue");
            }
        } catch {
            toast.error("Network error while reordering");
        } finally {
            onChanged();
        }
    };

    return (
        <div className="border border-white/10 bg-black">
            <div className="px-4 py-2.5 border-b border-white/10">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <Users className="h-4 w-4 text-gray-400" /> Waiting — {subDomainLabel(subDomain)} ({totalWaiting})
                </h3>
                <p className="mt-0.5 text-xs text-gray-500">
                    Click a table button to call that recruit there. Drag to reorder within a table&apos;s own line.
                </p>
            </div>
            {loading ? (
                <div className="p-5 text-center text-gray-500 text-sm">Loading...</div>
            ) : totalWaiting === 0 ? (
                <div className="p-5 text-center text-gray-500 text-sm">Nobody is waiting.</div>
            ) : (
                <div className="p-3 space-y-3">
                    {groups.map(
                        (g) =>
                            g.waiting.length > 0 && (
                                <div key={g.panel.id}>
                                    {openPanels.length > 1 && (
                                        <p className="mb-1.5 text-[11px] font-bold uppercase tracking-widest text-gray-500">
                                            {g.panel.domain_label}
                                        </p>
                                    )}
                                    <DndContext
                                        sensors={dragSensors}
                                        collisionDetection={closestCenter}
                                        onDragEnd={makeDragEndHandler(g.panel.id, g.waiting)}
                                    >
                                        <SortableContext items={g.waiting.map((t) => t.token_id)} strategy={verticalListSortingStrategy}>
                                            <div className="space-y-1.5">
                                                {g.waiting.map((t) => (
                                                    <SortableSharedRow
                                                        key={t.token_id}
                                                        token={t}
                                                        openPanels={openPanels}
                                                        onCall={callToken}
                                                        callingId={callingId}
                                                    />
                                                ))}
                                            </div>
                                        </SortableContext>
                                    </DndContext>
                                </div>
                            )
                    )}
                </div>
            )}
        </div>
    );
}

// One sub-domain's full board: its own "Add Table" (domain already fixed), every open
// table's TableSlot, any closed tables for this domain (compact PanelCard), and the one
// shared waiting queue for the whole domain.
function SubDomainBoard({
    subDomain,
    panels,
    tokensByPanel,
    loading,
    onChanged,
}: {
    subDomain: RecruitSubDomain;
    panels: Panel[];
    tokensByPanel: Record<string, QueueToken[]>;
    loading: boolean;
    onChanged: () => void;
}) {
    const openPanels = panels.filter((p) => p.is_active).sort((a, b) => (a.table_number ?? 0) - (b.table_number ?? 0));
    const closedPanels = panels.filter((p) => !p.is_active);

    return (
        <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-sm font-black uppercase tracking-wide text-white">{subDomainLabel(subDomain)}</h3>
                <AddPanelForm subDomain={subDomain} onCreated={onChanged} />
            </div>

            {openPanels.length === 0 && closedPanels.length === 0 && (
                <div className="border border-white/10 bg-black p-5 text-center text-xs text-gray-500">
                    No tables open yet.
                </div>
            )}

            {openPanels.map((p) => (
                <TableSlot key={p.id} panel={p} tokens={tokensByPanel[p.id] ?? []} onChanged={onChanged} />
            ))}

            {closedPanels.length > 0 && (
                <div className="space-y-2">
                    {closedPanels.map((p) => (
                        <PanelCard key={p.id} panel={p} onChanged={onChanged} />
                    ))}
                </div>
            )}

            {openPanels.length > 0 && (
                <SharedWaitingQueue
                    subDomain={subDomain}
                    openPanels={openPanels}
                    tokensByPanel={tokensByPanel}
                    loading={loading}
                    onChanged={onChanged}
                />
            )}
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
}

const RESULT_STYLES: Record<InterviewResultRow["result"], string> = {
    selected: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30",
    rejected: "bg-red-500/10 text-red-400 ring-red-500/30",
    waitlisted: "bg-amber-500/10 text-amber-400 ring-amber-500/30",
};

// Groups results by domain, RECRUIT_SUBDOMAINS order first (so sections always appear in
// the same place regardless of interview order), any unrecognised domain appended after —
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
// uses, WITHOUT a panel_id — per the route's documented judgment call, omitting it
// means the correction only touches the result row (and recomputes is_selected),
// never token state. This is the only place in the app a logged result can be seen
// or fixed after the fact — logging a result removes it from the panel dashboard
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
                        Correcting <span className="text-white font-semibold">{row.name}</span> — {subDomainFullLabel(row.sub_domain)}
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

// One collapsible section per domain — counts in the header so a lead can see at a glance
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
                                                <span className="font-medium text-white">{row.name}</span>
                                                {row.is_walkin && (
                                                    <span
                                                        title="Not shortlisted — let in as a walk-in"
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
                                                {row.notes || "—"}
                                            </span>
                                        </td>
                                        <td className="px-5 py-2.5 text-gray-400 text-xs">{row.interviewer_username}</td>
                                        <td className="px-5 py-2.5 text-gray-400 text-xs">
                                            {row.decided_at ? new Date(row.decided_at).toLocaleString() : "—"}
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
                <h2 className="text-base font-bold text-white">Interview Results — by Domain</h2>
                <span className="text-xs text-gray-500">({rows.length} total)</span>
            </div>
            {loading ? (
                <div className="border border-white/10 bg-black p-6 text-center text-sm text-gray-500">
                    Loading...
                </div>
            ) : rows.length === 0 ? (
                <div className="border border-white/10 bg-black p-6 text-center text-sm text-gray-500">
                    No results logged yet — they&apos;ll show up here as panels call recruits in.
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
    const [panels, setPanels] = useState<Panel[]>([]);
    const [tokensByPanel, setTokensByPanel] = useState<Record<string, QueueToken[]>>({});
    const [loading, setLoading] = useState(true);
    const [queuesLoading, setQueuesLoading] = useState(true);
    const [noCycle, setNoCycle] = useState(false);

    const loadPanels = useCallback(async (): Promise<Panel[]> => {
        try {
            const res = await fetch("/api/admin/recruitment/panels");
            const data = await res.json();
            if (res.ok) {
                setNoCycle(false);
                const list: Panel[] = data.data ?? [];
                setPanels(list);
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

    // Every currently open table's own queue, fetched in parallel. The old master-detail
    // dashboard only ever fetched one (the selected) panel's queue at a time; the new
    // all-tables-visible-at-once board needs every open table's queue simultaneously so
    // it can render each one's own "Now Serving" slot plus the merged shared queue.
    const loadQueues = useCallback(async (panelList: Panel[]) => {
        const openIds = panelList.filter((p) => p.is_active).map((p) => p.id);
        if (openIds.length === 0) {
            setTokensByPanel({});
            setQueuesLoading(false);
            return;
        }
        try {
            const results = await Promise.all(
                openIds.map(async (id) => {
                    const res = await fetch(`/api/admin/recruitment/panels/${id}/queue`);
                    const data = await res.json();
                    return [id, res.ok ? ((data.data ?? []) as QueueToken[]) : []] as const;
                })
            );
            setTokensByPanel(Object.fromEntries(results));
        } finally {
            setQueuesLoading(false);
        }
    }, []);

    // Always reads the just-fetched panel list directly (not React state, which wouldn't
    // have committed yet) so loadQueues never races a stale panels array.
    const refreshAll = useCallback(async () => {
        const list = await loadPanels();
        await loadQueues(list);
    }, [loadPanels, loadQueues]);

    useEffect(() => {
        if (!ready) return;
        refreshAll();
        const interval = setInterval(refreshAll, 5000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready]);

    if (!ready) return null;

    const totals = panels.reduce(
        (acc, p) => ({
            open: acc.open + (p.is_active ? 1 : 0),
            waiting: acc.waiting + p.counts.waiting,
            called: acc.called + p.counts.called,
            done: acc.done + p.counts.done,
        }),
        { open: 0, waiting: 0, called: 0, done: 0 }
    );

    // 4 columns, one per subsystem, in RECRUIT_SUBSYSTEMS order (SPACED, SIESED, MCSOCD,
    // SAMBED) — SPACED/MCSOCD naturally end up with 2 stacked SubDomainBoards since they
    // have 2 sub-domains each; SIESED/SAMBED get exactly 1, filling the column alone.
    const subsystemGroups = groupBySubsystem();
    // Pre-2026-08-13 free-text panels (or any panel somehow created with no sub_domain)
    // don't belong to any column above — surfaced separately so they stay manageable
    // instead of silently disappearing from the page.
    const legacyPanels = panels.filter((p) => !p.sub_domain);

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <Radio className="w-7 h-7 text-red" />
                        Interview Day
                    </h1>
                    <p className="mt-2 text-gray-400 text-sm max-w-xl">
                        Every subsystem&apos;s tables at once — call recruits in, pull anyone from a shared domain
                        queue to your own table, and log results. Walk-in, no time slots.
                    </p>
                </div>

                {!noCycle && !loading && panels.length > 0 && (
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1.5 bg-white/5 px-3 py-1.5 font-semibold text-gray-300 ring-1 ring-inset ring-white/10">
                            {totals.open} of {panels.length} tables open
                        </span>
                        <span className="inline-flex items-center gap-1.5 bg-amber-500/10 px-3 py-1.5 font-semibold text-amber-400 ring-1 ring-inset ring-amber-500/20">
                            <Clock3 className="h-3.5 w-3.5" /> {totals.waiting} waiting
                        </span>
                        <span className="inline-flex items-center gap-1.5 bg-blue-500/10 px-3 py-1.5 font-semibold text-blue-400 ring-1 ring-inset ring-blue-500/20">
                            <PhoneCall className="h-3.5 w-3.5" /> {totals.called} in progress
                        </span>
                        <span className="inline-flex items-center gap-1.5 bg-emerald-500/10 px-3 py-1.5 font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
                            <CheckCircle2 className="h-3.5 w-3.5" /> {totals.done} done
                        </span>
                    </div>
                )}
            </div>

            {noCycle ? (
                <div className="border border-amber-500/30 bg-black p-6 text-sm text-amber-300">
                    No active recruitment cycle. Start one from Cycles before opening interview panels.
                </div>
            ) : loading ? (
                <div className="p-8 text-center text-gray-500 text-sm">Loading tables...</div>
            ) : (
                <>
                    <div className="grid grid-cols-1 xl:grid-cols-4 gap-6 items-start">
                        {subsystemGroups.map((group) => (
                            <div key={group.subsystem} className="space-y-6">
                                <h2 className="text-xs font-black uppercase tracking-widest text-red">{group.subsystem}</h2>
                                {group.domains.map((d) => (
                                    <SubDomainBoard
                                        key={d.key}
                                        subDomain={d.key}
                                        panels={panels.filter((p) => p.sub_domain === d.key)}
                                        tokensByPanel={tokensByPanel}
                                        loading={queuesLoading}
                                        onChanged={refreshAll}
                                    />
                                ))}
                            </div>
                        ))}
                    </div>

                    {legacyPanels.length > 0 && (
                        <div className="space-y-3">
                            <h2 className="text-xs font-black uppercase tracking-widest text-gray-500">
                                Unassigned Tables (no domain)
                            </h2>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {legacyPanels.map((p) => (
                                    <PanelCard key={p.id} panel={p} onChanged={refreshAll} />
                                ))}
                            </div>
                        </div>
                    )}
                </>
            )}

            {!noCycle && <InterviewResultsList />}
        </div>
    );
}
