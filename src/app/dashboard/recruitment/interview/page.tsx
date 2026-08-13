"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import {
    Radio,
    Plus,
    Users,
    PhoneCall,
    CheckCircle2,
    XCircle,
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
}

interface QueueToken {
    token_id: string;
    token_number: number;
    queue_position: number;
    status: TokenStatus;
    recruit: RecruitProfile;
    checked_in_at: string;
    called_at?: string;
}

import { RECRUIT_SUBDOMAINS, subDomainLabel, subDomainFullLabel, subDomainSubsystem } from "@/lib/recruit-domains";
import Select from "@/components/ui/select";

function AddPanelForm({ onCreated }: { onCreated: () => void }) {
    const [open, setOpen] = useState(false);
    const [subDomain, setSubDomain] = useState("");
    const [name, setName] = useState("");
    const [busy, setBusy] = useState(false);

    // Prefills the name with "<Subsystem>-<Domain>-" every time the domain changes —
    // table_number (routing/kiosk grouping) is still auto-allocated server-side
    // regardless of what the creator does with this text from here.
    const handleDomainChange = (value: string) => {
        setSubDomain(value);
        const meta = RECRUIT_SUBDOMAINS.find((d) => d.key === value);
        setName(meta ? `${meta.subsystem}-${meta.label}-` : "");
    };

    const submit = async () => {
        if (!subDomain) {
            toast.error("Pick a domain first");
            return;
        }
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
                setSubDomain("");
                setName("");
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
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-red/15 px-4 py-2.5 text-sm font-semibold text-red ring-1 ring-inset ring-red/40 transition hover:bg-red/25"
            >
                <Plus className="h-4 w-4" /> Add Table
            </button>
        );
    }

    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-4 space-y-3">
            <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-gray-500">Domain</label>
                <Select
                    value={subDomain}
                    onChange={handleDomainChange}
                    placeholder="Select a domain..."
                    options={RECRUIT_SUBDOMAINS.map((d) => ({ value: d.key, label: `${d.subsystem} — ${d.label}` }))}
                />
            </div>
            <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-gray-500">Table name</label>
                <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                    maxLength={50}
                    disabled={!subDomain}
                    placeholder="Pick a domain first"
                    className="w-full rounded-lg border-0 bg-white/5 py-2 px-3 text-sm text-white ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500 disabled:opacity-50"
                />
                <p className="mt-1.5 text-xs text-gray-500">
                    Edit it however you like — just has to be unique among this domain&apos;s tables.
                </p>
            </div>
            <div className="flex gap-2">
                <button
                    onClick={submit}
                    disabled={busy}
                    className="flex-1 rounded-lg bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/30 transition hover:bg-emerald-500/25 disabled:opacity-50"
                >
                    Create
                </button>
                <button
                    onClick={() => {
                        setOpen(false);
                        setSubDomain("");
                        setName("");
                    }}
                    disabled={busy}
                    className="rounded-lg bg-white/5 px-3 py-2 text-xs font-semibold text-gray-400 ring-1 ring-inset ring-white/10 transition hover:bg-white/10"
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}

function PanelCard({
    panel,
    selected,
    onSelect,
    onClosed,
    onDeleted,
}: {
    panel: Panel;
    selected: boolean;
    onSelect: () => void;
    onClosed: () => void;
    onDeleted: () => void;
}) {
    const [busy, setBusy] = useState(false);

    // Reversible pause — Reopen brings back any stranded `waiting` tokens exactly as they
    // were. Nobody is moved anywhere.
    const closePanel = async () => {
        if (!confirm(`Pause "${panel.domain_label}"? Remaining waiting tokens are left as-is — Reopen brings them back.`)) return;
        setBusy(true);
        try {
            const res = await fetch(`/api/admin/recruitment/panels/${panel.id}/close`, { method: "PATCH" });
            const data = await res.json();
            if (res.ok && data.closed) {
                toast.success("Table paused");
                onClosed();
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
                toast.success(parts.length > 0 ? `Table closed — ${parts.join(", ")}` : "Table closed for the day");
                onClosed();
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
                ? `\n\n${queued} recruit(s) are still queued on this table — they'll be redistributed to another open table for the same domain, or deferred to another day if none is open.`
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
                toast.success(`Deleted "${panel.domain_label}"${parts.length > 0 ? ` — ${parts.join(", ")}` : ""}`);
                onDeleted();
            } else {
                toast.error(data.error || "Could not delete table");
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <div
            onClick={onSelect}
            className={`cursor-pointer rounded-2xl border p-4 transition ${
                selected
                    ? "border-red/50 bg-red/[0.08]"
                    : "border-white/10 bg-white/[0.03] hover:bg-white/[0.06]"
            } backdrop-blur-xl`}
        >
            <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                    <span
                        className={`h-2 w-2 shrink-0 rounded-full ${panel.is_active ? "bg-emerald-400" : "bg-gray-600"}`}
                    />
                    <h3 className="truncate font-bold text-white">{panel.domain_label}</h3>
                    {!panel.is_active && (
                        <span className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-400">
                            Closed
                        </span>
                    )}
                </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-lg bg-amber-500/10 px-2 py-1 font-semibold text-amber-400 ring-1 ring-inset ring-amber-500/20">
                    <Clock3 className="h-3 w-3" /> Waiting: {panel.counts.waiting}
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg bg-blue-500/10 px-2 py-1 font-semibold text-blue-400 ring-1 ring-inset ring-blue-500/20">
                    <PhoneCall className="h-3 w-3" /> Called: {panel.counts.called}
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/10 px-2 py-1 font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
                    <CheckCircle2 className="h-3 w-3" /> Done: {panel.counts.done}
                </span>
                {panel.counts.no_show > 0 && (
                    <span className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-2 py-1 font-semibold text-gray-400 ring-1 ring-inset ring-white/10">
                        <UserX className="h-3 w-3" /> No-show: {panel.counts.no_show}
                    </span>
                )}
            </div>

            <div className="mt-3 flex flex-wrap gap-2" onClick={(e) => e.stopPropagation()}>
                {panel.is_active && (
                    <>
                        <button
                            onClick={closePanel}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
                        >
                            Pause
                        </button>
                        <button
                            onClick={closeForDay}
                            disabled={busy}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-400 ring-1 ring-inset ring-red-500/30 transition hover:bg-red-500/25 disabled:opacity-50"
                        >
                            Close for the Day
                        </button>
                    </>
                )}
                <button
                    onClick={deletePanel}
                    disabled={busy}
                    title={`Delete ${panel.domain_label} table`}
                    className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 ring-1 ring-inset ring-red-500/30 transition hover:bg-red-500/25 disabled:opacity-50"
                >
                    <Trash2 className="h-3.5 w-3.5" /> Delete
                </button>
            </div>
        </div>
    );
}

function RecruitProfileCard({ token }: { token: QueueToken }) {
    const r = token.recruit;
    return (
        <div className="rounded-xl border border-white/10 bg-black/30 p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
                <div>
                    <p className="text-lg font-black text-white">
                        #{token.token_number} — {r.name}
                    </p>
                    <p className="text-sm text-gray-400">
                        {r.reg_no} · Year {r.year} · {r.department}
                    </p>
                    <p className="mt-1 text-sm text-gray-400">
                        {r.is_hosteller ? `Hosteller${r.hostel_block ? ` · ${r.hostel_block}` : ""}` : "Day Scholar"}
                    </p>
                </div>
                {r.portfolio_url && (
                    <a
                        href={r.portfolio_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 rounded-lg bg-blue-500/15 px-3 py-1.5 text-xs font-semibold text-blue-400 ring-1 ring-inset ring-blue-500/30 transition hover:bg-blue-500/25"
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
                            className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold ring-1 ring-inset ${
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
                                className="rounded-lg bg-white/5 px-2 py-1 text-xs font-semibold text-gray-300 ring-1 ring-inset ring-white/10"
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

function PanelDashboard({ panel, onChanged }: { panel: Panel; onChanged: () => void }) {
    const [queue, setQueue] = useState<QueueToken[]>([]);
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [notes, setNotes] = useState("");

    const loadQueue = useCallback(async () => {
        try {
            const res = await fetch(`/api/admin/recruitment/panels/${panel.id}/queue`);
            const data = await res.json();
            if (res.ok) setQueue(data.data ?? []);
        } finally {
            setLoading(false);
        }
    }, [panel.id]);

    useEffect(() => {
        setLoading(true);
        loadQueue();
        const interval = setInterval(loadQueue, 5000);
        return () => clearInterval(interval);
    }, [loadQueue]);

    const called = queue.find((t) => t.status === "called") ?? null;
    const waiting = queue.filter((t) => t.status === "waiting");
    const history = queue.filter((t) => t.status !== "waiting" && t.status !== "called");

    const dragSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    // Optimistically reorders the local waiting list, then persists just the moved
    // token's new position — see the reorder route for why only one row is touched.
    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = waiting.findIndex((t) => t.token_id === active.id);
        const newIndex = waiting.findIndex((t) => t.token_id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;

        const reordered = arrayMove(waiting, oldIndex, newIndex);
        setQueue((prev) => [...reordered, ...prev.filter((t) => t.status !== "waiting")]);

        const movedToken = reordered[newIndex];
        const afterToken = newIndex > 0 ? reordered[newIndex - 1] : null;

        try {
            const res = await fetch(
                `/api/admin/recruitment/panels/${panel.id}/tokens/${movedToken.token_id}/reorder`,
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
            loadQueue();
        }
    };

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
                toast.success(`Called #${data.token_number} — ${data.recruit?.name ?? ""}`);
            }
            await loadQueue();
            onChanged();
        } finally {
            setBusy(false);
        }
    };

    const logResult = async (result: "selected" | "rejected" | "waitlisted") => {
        if (!called) return;
        if (!panel.sub_domain) {
            toast.error("This panel has no domain set — cannot log a result");
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
                await loadQueue();
                onChanged();
            } else {
                toast.error(data.error || "Could not log result");
            }
        } finally {
            setBusy(false);
        }
    };

    const markNoShow = async () => {
        if (!called) return;
        if (!confirm(`Mark #${called.token_number} — ${called.recruit.name} as no-show?`)) return;
        setBusy(true);
        try {
            const res = await fetch(`/api/admin/recruitment/panels/tokens/${called.token_id}/no-show`, {
                method: "PATCH",
            });
            const data = await res.json();
            if (res.ok && data.no_show) {
                toast.success("Marked no-show");
                await loadQueue();
                onChanged();
            } else {
                toast.error(data.error || "Could not mark no-show");
            }
        } finally {
            setBusy(false);
        }
    };

    return (
        <div className="space-y-5">
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-5">
                <div className="flex items-center justify-between gap-3 flex-wrap">
                    <h2 className="text-xl font-black text-white">{panel.domain_label}</h2>
                    <button
                        onClick={callNext}
                        disabled={busy || !panel.is_active || Boolean(called) || waiting.length === 0}
                        className="inline-flex items-center gap-2 rounded-xl bg-red px-5 py-2.5 text-sm font-bold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
                    >
                        <PhoneCall className="h-4 w-4" /> Call Next
                    </button>
                </div>
                {!panel.is_active && (
                    <p className="mt-2 text-xs text-amber-400">
                        This table is closed — remaining tokens are visible but no new recruits can check in.
                    </p>
                )}
            </div>

            {called ? (
                <div className="rounded-2xl border border-blue-500/30 bg-blue-500/[0.06] backdrop-blur-xl p-5 space-y-4">
                    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-400">
                        <PhoneCall className="h-4 w-4" /> Now Interviewing
                    </div>
                    <RecruitProfileCard token={called} />

                    <div className="space-y-3">
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            placeholder="Optional notes..."
                            rows={2}
                            className="w-full rounded-lg border-0 bg-white/5 py-2 px-3 text-sm text-white placeholder:text-gray-500 ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500"
                        />

                        <div className="flex flex-wrap gap-2">
                            <button
                                onClick={() => logResult("selected")}
                                disabled={busy || !panel.sub_domain}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/30 transition hover:bg-emerald-500/25 disabled:opacity-50"
                            >
                                <Award className="h-4 w-4" /> Selected
                            </button>
                            <button
                                onClick={() => logResult("rejected")}
                                disabled={busy || !panel.sub_domain}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-400 ring-1 ring-inset ring-red-500/30 transition hover:bg-red-500/25 disabled:opacity-50"
                            >
                                <Ban className="h-4 w-4" /> Rejected
                            </button>
                            <button
                                onClick={() => logResult("waitlisted")}
                                disabled={busy || !panel.sub_domain}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500/15 px-4 py-2 text-sm font-semibold text-amber-400 ring-1 ring-inset ring-amber-500/30 transition hover:bg-amber-500/25 disabled:opacity-50"
                            >
                                <Hourglass className="h-4 w-4" /> Waitlisted
                            </button>
                            <button
                                onClick={markNoShow}
                                disabled={busy}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-4 py-2 text-sm font-semibold text-gray-400 ring-1 ring-inset ring-white/10 transition hover:bg-white/10 ml-auto"
                            >
                                <UserX className="h-4 w-4" /> No Show
                            </button>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-8 text-center text-sm text-gray-500">
                    No one is currently being interviewed. Click &ldquo;Call Next&rdquo; to bring up the next recruit.
                </div>
            )}

            <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden">
                <div className="px-5 py-3 border-b border-white/10">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-400" /> Up Next ({waiting.length})
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-500">Drag to reorder who comes next.</p>
                </div>
                {loading ? (
                    <div className="p-6 text-center text-gray-500 text-sm">Loading...</div>
                ) : waiting.length === 0 ? (
                    <div className="p-6 text-center text-gray-500 text-sm">Nobody is waiting.</div>
                ) : (
                    <div className="p-3 space-y-1.5">
                        <DndContext sensors={dragSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                            <SortableContext items={waiting.map((t) => t.token_id)} strategy={verticalListSortingStrategy}>
                                {waiting.map((t) => (
                                    <SortableWaitingRow key={t.token_id} token={t} />
                                ))}
                            </SortableContext>
                        </DndContext>
                    </div>
                )}
            </div>

            {history.length > 0 && (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden">
                    <div className="px-5 py-3 border-b border-white/10">
                        <h3 className="text-sm font-bold text-white">History ({history.length})</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-white/10">
                                    <th className="px-5 py-2.5">#</th>
                                    <th className="px-5 py-2.5">Name</th>
                                    <th className="px-5 py-2.5">Reg No</th>
                                    <th className="px-5 py-2.5">Status</th>
                                </tr>
                            </thead>
                            <tbody>
                                {history.map((t) => (
                                    <tr key={t.token_id} className="border-b border-white/5 last:border-0">
                                        <td className="px-5 py-2.5 font-mono text-gray-300">{t.token_number}</td>
                                        <td className="px-5 py-2.5 text-white font-medium">{t.recruit.name}</td>
                                        <td className="px-5 py-2.5 text-gray-400">{t.recruit.reg_no}</td>
                                        <td className="px-5 py-2.5">
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                                    t.status === "done"
                                                        ? "bg-emerald-500/10 text-emerald-400"
                                                        : "bg-white/5 text-gray-500"
                                                }`}
                                            >
                                                {t.status.replace("_", " ")}
                                            </span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

function SortableWaitingRow({ token }: { token: QueueToken }) {
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
            className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5"
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
            <span className="shrink-0 text-xs text-gray-500">{token.recruit.reg_no}</span>
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
    interviewer_username: string;
    decided_at: string | null;
}

const RESULT_STYLES: Record<InterviewResultRow["result"], string> = {
    selected: "bg-emerald-500/10 text-emerald-400 ring-emerald-500/30",
    rejected: "bg-red-500/10 text-red-400 ring-red-500/30",
    waitlisted: "bg-amber-500/10 text-amber-400 ring-amber-500/30",
};

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
                        className="flex-1 min-w-[160px] rounded-lg border-0 bg-white/5 py-1.5 px-3 text-sm text-white ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                        onClick={() => submit("selected")}
                        disabled={busy}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/30 hover:bg-emerald-500/25 disabled:opacity-50"
                    >
                        <Award className="h-3.5 w-3.5" /> Selected
                    </button>
                    <button
                        onClick={() => submit("rejected")}
                        disabled={busy}
                        className="inline-flex items-center gap-1 rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-400 ring-1 ring-inset ring-red-500/30 hover:bg-red-500/25 disabled:opacity-50"
                    >
                        <Ban className="h-3.5 w-3.5" /> Rejected
                    </button>
                    <button
                        onClick={() => submit("waitlisted")}
                        disabled={busy}
                        className="inline-flex items-center gap-1 rounded-lg bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-400 ring-1 ring-inset ring-amber-500/30 hover:bg-amber-500/25 disabled:opacity-50"
                    >
                        <Hourglass className="h-3.5 w-3.5" /> Waitlisted
                    </button>
                    <button
                        onClick={onCancel}
                        disabled={busy}
                        className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-400 ring-1 ring-inset ring-white/10 hover:bg-white/10"
                    >
                        <X className="h-3.5 w-3.5" /> Cancel
                    </button>
                </div>
            </td>
        </tr>
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

    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden">
            <div className="px-5 py-4 border-b border-white/10 flex items-center gap-2">
                <ClipboardList className="h-4 w-4 text-gray-400" />
                <h2 className="text-sm font-bold text-white">Interview Results</h2>
                <span className="text-xs text-gray-500">({rows.length})</span>
            </div>
            {loading ? (
                <div className="p-6 text-center text-gray-500 text-sm">Loading...</div>
            ) : rows.length === 0 ? (
                <div className="p-6 text-center text-gray-500 text-sm">
                    No results logged yet — they&apos;ll show up here as panels call recruits in.
                </div>
            ) : (
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="text-left text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-white/10">
                                <th className="px-5 py-2.5">Name</th>
                                <th className="px-5 py-2.5">Domain</th>
                                <th className="px-5 py-2.5">Result</th>
                                <th className="px-5 py-2.5">Interviewer</th>
                                <th className="px-5 py-2.5">Decided</th>
                                <th className="px-5 py-2.5 text-right">Correct</th>
                            </tr>
                        </thead>
                        <tbody>
                            {rows.map((row) =>
                                editingId === row.id ? (
                                    <EditResultRow
                                        key={row.id}
                                        row={row}
                                        onCancel={() => setEditingId(null)}
                                        onSaved={() => {
                                            setEditingId(null);
                                            load();
                                        }}
                                    />
                                ) : (
                                    <tr key={row.id} className="border-b border-white/5 last:border-0">
                                        <td className="px-5 py-2.5 text-white font-medium">{row.name}</td>
                                        <td className="px-5 py-2.5 text-gray-300">
                                            {subDomainLabel(row.sub_domain)}{" "}
                                            <span className="text-xs text-gray-500">{subDomainSubsystem(row.sub_domain)}</span>
                                        </td>
                                        <td className="px-5 py-2.5">
                                            <span className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-semibold ring-1 ring-inset capitalize ${RESULT_STYLES[row.result]}`}>
                                                {row.result}
                                            </span>
                                        </td>
                                        <td className="px-5 py-2.5 text-gray-400 text-xs">{row.interviewer_username}</td>
                                        <td className="px-5 py-2.5 text-gray-400 text-xs">
                                            {row.decided_at ? new Date(row.decided_at).toLocaleString() : "—"}
                                        </td>
                                        <td className="px-5 py-2.5 text-right">
                                            <button
                                                onClick={() => setEditingId(row.id)}
                                                className="inline-flex items-center gap-1 rounded-lg bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-300 ring-1 ring-inset ring-white/10 hover:bg-white/10"
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

export default function InterviewManagementPage() {
    const ready = useRequireRole(["member", "lead", "admin"]);
    const [panels, setPanels] = useState<Panel[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [noCycle, setNoCycle] = useState(false);

    const loadPanels = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/recruitment/panels");
            const data = await res.json();
            if (res.ok) {
                setNoCycle(false);
                setPanels(data.data ?? []);
            } else if (res.status === 503) {
                setNoCycle(true);
            } else {
                toast.error(data.error || "Could not load panels");
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!ready) return;
        loadPanels();
        const interval = setInterval(loadPanels, 5000);
        return () => clearInterval(interval);
    }, [ready, loadPanels]);

    if (!ready) return null;

    const selectedPanel = panels.find((p) => p.id === selectedId) ?? null;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                    <Radio className="w-7 h-7 text-red" />
                    Interview Day
                </h1>
                <p className="mt-2 text-gray-400 text-sm max-w-xl">
                    Open tables, call recruits in, and log results — walk-in, no time slots. Add a table per
                    domain running today.
                </p>
            </div>

            {noCycle ? (
                <div className="rounded-2xl border border-amber-500/30 bg-amber-500/[0.06] p-6 text-sm text-amber-300">
                    No active recruitment cycle. Start one from Cycles before opening interview panels.
                </div>
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-[380px_1fr] gap-6 items-start">
                    <div className="space-y-4">
                        <AddPanelForm onCreated={loadPanels} />

                        {loading ? (
                            <div className="p-8 text-center text-gray-500 text-sm">Loading panels...</div>
                        ) : panels.length === 0 ? (
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-sm text-gray-500">
                                No panels yet. Add one to get started.
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {panels.map((p) => (
                                    <PanelCard
                                        key={p.id}
                                        panel={p}
                                        selected={p.id === selectedId}
                                        onSelect={() => setSelectedId(p.id)}
                                        onClosed={loadPanels}
                                        onDeleted={() => {
                                            setSelectedId((cur) => (cur === p.id ? null : cur));
                                            loadPanels();
                                        }}
                                    />
                                ))}
                            </div>
                        )}
                    </div>

                    <div>
                        {selectedPanel ? (
                            <PanelDashboard panel={selectedPanel} onChanged={loadPanels} />
                        ) : (
                            <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-12 text-center text-sm text-gray-500">
                                Select a panel on the left to open its dashboard.
                            </div>
                        )}
                    </div>
                </div>
            )}

            {!noCycle && <InterviewResultsList />}
        </div>
    );
}
