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
    ExternalLink,
    UserX,
    Award,
    Star,
    Ban,
    Hourglass,
    Trash2,
    ClipboardList,
    Pencil,
    X,
} from "lucide-react";
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
}

interface QueueToken {
    token_id: string;
    token_number: number;
    status: TokenStatus;
    recruit: RecruitProfile;
    checked_in_at: string;
    called_at?: string;
}

import { subDomainLabel, subDomainFullLabel, subDomainSubsystem } from "@/lib/recruit-domains";
import Select from "@/components/ui/select";

function AddPanelForm({ onCreated }: { onCreated: () => void }) {
    const [open, setOpen] = useState(false);
    const [label, setLabel] = useState("");
    const [busy, setBusy] = useState(false);

    const submit = async () => {
        const domain_label = label.trim();
        if (!domain_label) {
            toast.error("Enter a panel name first");
            return;
        }
        setBusy(true);
        try {
            const res = await fetch("/api/admin/recruitment/panels", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ domain_label }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(`Panel "${domain_label}" is live`);
                setLabel("");
                setOpen(false);
                onCreated();
            } else {
                toast.error(data.error || "Could not create panel");
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
                <Plus className="h-4 w-4" /> Add Panel
            </button>
        );
    }

    return (
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-4 space-y-3">
            <label className="block text-xs font-bold uppercase tracking-widest text-gray-500">
                Panel name (e.g. Coding, SIESED, Web Dev)
            </label>
            <input
                autoFocus
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && submit()}
                maxLength={50}
                placeholder="Coding"
                className="w-full rounded-lg border-0 bg-white/5 py-2 px-3 text-sm text-white ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500"
            />
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
                        setLabel("");
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

    const closePanel = async () => {
        if (!confirm(`Close "${panel.domain_label}"? Remaining waiting tokens are left as-is.`)) return;
        setBusy(true);
        try {
            const res = await fetch(`/api/admin/recruitment/panels/${panel.id}/close`, { method: "PATCH" });
            const data = await res.json();
            if (res.ok && data.closed) {
                toast.success("Panel closed");
                onClosed();
            } else {
                toast.error(data.error || "Could not close panel");
            }
        } finally {
            setBusy(false);
        }
    };

    // Hard delete — drops the panel and every token issued against it. Interview results
    // already logged are keyed on recruit+domain, not panel, so they are unaffected.
    const deletePanel = async () => {
        const queued = panel.counts.waiting + panel.counts.called;
        const warning = queued > 0 ? `\n\n${queued} recruit(s) are still queued on this panel — their tokens will be discarded.` : "";
        if (!confirm(`Permanently delete the "${panel.domain_label}" panel?${warning}\n\nThis cannot be undone.`)) return;
        setBusy(true);
        try {
            const res = await fetch(`/api/admin/recruitment/panels/${panel.id}`, { method: "DELETE" });
            const data = await res.json();
            if (res.ok && data.deleted) {
                toast.success(`Deleted panel "${panel.domain_label}"`);
                onDeleted();
            } else {
                toast.error(data.error || "Could not delete panel");
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

            <div className="mt-3 flex gap-2" onClick={(e) => e.stopPropagation()}>
                <a
                    href={`/dashboard/recruitment/interview/panel/${panel.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
                >
                    Open Queue Display <ExternalLink className="h-3.5 w-3.5" />
                </a>
                {panel.is_active && (
                    <button
                        onClick={closePanel}
                        disabled={busy}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-400 ring-1 ring-inset ring-red-500/30 transition hover:bg-red-500/25 disabled:opacity-50"
                    >
                        Close Panel
                    </button>
                )}
                <button
                    onClick={deletePanel}
                    disabled={busy}
                    title={`Delete ${panel.domain_label} panel`}
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
    const [selectedSubDomain, setSelectedSubDomain] = useState("");

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
    const resultOptions = called ? (called.recruit.shortlisted_for.length > 0 ? called.recruit.shortlisted_for : called.recruit.domains) : [];

    useEffect(() => {
        if (called) {
            setSelectedSubDomain((prev) => (resultOptions.includes(prev) ? prev : resultOptions[0] ?? ""));
        } else {
            setSelectedSubDomain("");
            setNotes("");
        }
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
        if (!selectedSubDomain) {
            toast.error("Pick which domain this result is for");
            return;
        }
        setBusy(true);
        try {
            const res = await fetch("/api/admin/recruitment/interview-results", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    recruit_id: called.recruit.id,
                    sub_domain: selectedSubDomain,
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
                    <h2 className="text-xl font-black text-white">{panel.domain_label} — Panel Dashboard</h2>
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
                        This panel is closed — remaining tokens are visible but no new recruits can check in.
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
                        <div>
                            <label className="block text-[11px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                                Log result for domain
                            </label>
                            {resultOptions.length > 0 ? (
                                <div className="max-w-xs">
                                    <Select
                                        accent="blue"
                                        value={selectedSubDomain}
                                        onChange={setSelectedSubDomain}
                                        className="bg-white/5 ring-white/10 py-2 px-3 text-sm"
                                        options={resultOptions.map((d) => ({ value: d, label: subDomainFullLabel(d) }))}
                                    />
                                </div>
                            ) : (
                                <p className="text-xs text-amber-400">
                                    No shortlisted or applied domain found for this recruit — result cannot be logged.
                                </p>
                            )}
                        </div>

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
                                disabled={busy || resultOptions.length === 0}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 px-4 py-2 text-sm font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/30 transition hover:bg-emerald-500/25 disabled:opacity-50"
                            >
                                <Award className="h-4 w-4" /> Selected
                            </button>
                            <button
                                onClick={() => logResult("rejected")}
                                disabled={busy || resultOptions.length === 0}
                                className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/15 px-4 py-2 text-sm font-semibold text-red-400 ring-1 ring-inset ring-red-500/30 transition hover:bg-red-500/25 disabled:opacity-50"
                            >
                                <Ban className="h-4 w-4" /> Rejected
                            </button>
                            <button
                                onClick={() => logResult("waitlisted")}
                                disabled={busy || resultOptions.length === 0}
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
                        <Users className="h-4 w-4 text-gray-400" /> Queue ({queue.length})
                    </h3>
                </div>
                {loading ? (
                    <div className="p-6 text-center text-gray-500 text-sm">Loading...</div>
                ) : queue.length === 0 ? (
                    <div className="p-6 text-center text-gray-500 text-sm">No one has checked in yet.</div>
                ) : (
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
                                {queue.map((t) => (
                                    <tr key={t.token_id} className="border-b border-white/5 last:border-0">
                                        <td className="px-5 py-2.5 font-mono text-gray-300">{t.token_number}</td>
                                        <td className="px-5 py-2.5 text-white font-medium">{t.recruit.name}</td>
                                        <td className="px-5 py-2.5 text-gray-400">{t.recruit.reg_no}</td>
                                        <td className="px-5 py-2.5">
                                            <span
                                                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                                    t.status === "waiting"
                                                        ? "bg-amber-500/10 text-amber-400"
                                                        : t.status === "called"
                                                          ? "bg-blue-500/10 text-blue-400"
                                                          : t.status === "done"
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
                )}
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
                    Open panels, call recruits in, and log results — walk-in, no time slots. Add a panel per
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
