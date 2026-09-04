"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
    ArrowLeft,
    PhoneCall,
    CheckCircle2,
    UserX,
    Award,
    Ban,
    Hourglass,
    Footprints,
    Users,
    Undo2,
} from "lucide-react";
import { useRequireRole } from "@/hooks/use-require-role";
import { subDomainFullLabel } from "@/lib/recruit-domains";
import RecruitProfileCard, { type RecruitProfile } from "@/components/recruit/RecruitProfileCard";

// The dedicated page for ONE interview table, reached by joining or creating a table from
// /dashboard/recruitment/interview. Table controls (Pause/Close/Delete) and result logging
// are scoped to this one panel_id, but the WAITING LIST is not (migration 024, 2026-09-03):
// recruits no longer get auto-routed to a specific table at check-in, so every open table
// for this domain shares ONE waiting pool. This page shows that shared pool and lets this
// table either Call Next (claims the oldest waiting recruit domain-wide) or manually call a
// specific one - both call-next and call-token do the actual per-panel assignment server-side
// the moment someone is called, not before.

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

interface DomainWaitingToken {
    token_id: string;
    token_number: number;
    checked_in_at: string;
    is_walkin: boolean;
    recruit: RecruitProfile;
    review_note: string | null;
    rating: "bad" | "average" | "good" | null;
    interested_other_clubs: string | null;
    interested_other_domains: string | null;
    review_updated_by: string | null;
    review_updated_at: string | null;
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
    review_note: string | null;
    rating: "bad" | "average" | "good" | null;
    interested_other_clubs: string | null;
    interested_other_domains: string | null;
    review_updated_by: string | null;
    review_updated_at: string | null;
}

// Shared by TableControls' Pause / Close-for-Day / Delete network calls (the picker page
// has its own copy for PanelCard) - kept as two small copies rather than a shared module so
// each page stays self-contained per the two-file split.
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

// Compact action strip for this table - Pause/Close for the Day/Delete.
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
                Delete
            </button>
        </div>
    );
}

// This table's "Now Serving" slot (the `called` token, rendered big via RecruitProfileCard)
// and inline result-logging (Selected/Rejected/Waitlisted). Reused from the old board
// unchanged in data-fetching/API calls and prop signature for those parts - only its
// layout/sizing is bumped here (larger text, more padding) since it's now the centerpiece of
// a side-by-side page instead of one card among many. Call Next itself is lifted to the
// parent (2026-09-04) and rendered inside DomainWaitingPool's header instead - it claims the
// front of that exact list, so the button now lives next to what it acts on.
function TableSlot({
    panel,
    tokens,
    onChanged,
}: {
    panel: Panel;
    tokens: QueueToken[];
    onChanged: () => void;
}) {
    const called = tokens.find((t) => t.status === "called") ?? null;
    const [notes, setNotes] = useState("");
    const [busy, setBusy] = useState(false);

    useEffect(() => {
        if (!called) setNotes("");
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [called?.token_id]);

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

    // "Called the wrong recruit by mistake" - puts them back in the shared domain pool
    // (not just a client-side dismiss) so any table, including this one, can call them
    // again properly. Distinct from No Show: that's a real outcome (they didn't show up),
    // this is undoing an interviewer's own mis-click.
    const uncall = async () => {
        if (!called) return;
        if (!confirm(`Uncall #${called.token_number}: ${called.recruit.name}? They'll go back to the waiting list.`)) return;
        setBusy(true);
        try {
            const res = await fetch(`/api/admin/recruitment/panels/tokens/${called.token_id}/uncall`, {
                method: "PATCH",
            });
            const data = await res.json();
            if (res.ok && data.uncalled) {
                toast.success("Sent back to waiting");
            } else {
                toast.error(data.error || "Could not uncall this recruit");
            }
        } finally {
            setBusy(false);
            onChanged();
        }
    };

    return (
        // min-h-0 is load-bearing: this is a direct child of the [panelId] page's
        // grid-cols-2 row, and CSS grid items default to min-height:auto, which overrides
        // h-full and lets the cell grow to fit its content (and the whole PAGE scroll,
        // defeating the point of the height-bounded shell) instead of clamping to the row's
        // allocated height and letting the inner overflow-y-auto div scroll internally.
        // Confirmed by an actual 1366x768 Playwright screenshot, not just reasoning about it.
        <div className="h-full min-h-0 flex flex-col border border-white/10 bg-black p-6">
            <div className="shrink-0 flex items-start justify-between gap-2 flex-wrap pb-4">
                <div className="min-w-0">
                    <h3 className="truncate text-lg font-bold text-white">{panel.domain_label}</h3>
                    <div className="mt-1.5 flex flex-wrap gap-1.5 text-[11px]">
                        {/* No per-table "waiting" badge (migration 024) - waiting recruits
                            belong to this domain's shared pool alongside this card, not this
                            specific table. */}
                        <span className="inline-flex items-center gap-1 bg-emerald-500/10 px-1.5 py-0.5 font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/20">
                            <CheckCircle2 className="h-3 w-3" /> {panel.counts.done} done
                        </span>
                    </div>
                </div>
                <TableControls panel={panel} onChanged={onChanged} />
            </div>

            {/* This card's own content can run longer than the viewport (full recruit
                profile + review fields + result buttons) - it scrolls within the card
                instead of growing the page, so the page itself never needs its own
                scrollbar. */}
            <div className="flex-1 min-h-0 overflow-y-auto">
                {called ? (
                    <div className="border border-blue-500/30 bg-blue-500/[0.06] p-6 space-y-4">
                        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-blue-400">
                            <PhoneCall className="h-4 w-4" /> Now Serving
                        </div>
                        {/* Centerpiece per the exact ask: recruit name + this table's display
                            name, front and center above the fuller profile detail. */}
                        <div className="text-center py-2">
                            <p className="text-4xl font-black text-white leading-tight">{called.recruit.name}</p>
                            <p className="mt-1.5 text-sm font-bold uppercase tracking-widest text-blue-400">{panel.domain_label}</p>
                        </div>
                        <RecruitProfileCard token={called} onChanged={onChanged} />

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
                                    className="inline-flex items-center gap-1.5 bg-emerald-500/15 px-6 py-3 text-base font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/30 transition hover:bg-emerald-500/25 disabled:opacity-50"
                                >
                                    <Award className="h-5 w-5" /> Selected
                                </button>
                                <button
                                    onClick={() => logResult("rejected")}
                                    disabled={busy || !panel.sub_domain}
                                    className="inline-flex items-center gap-1.5 bg-red-500/15 px-6 py-3 text-base font-semibold text-red-400 ring-1 ring-inset ring-red-500/30 transition hover:bg-red-500/25 disabled:opacity-50"
                                >
                                    <Ban className="h-5 w-5" /> Rejected
                                </button>
                                <button
                                    onClick={() => logResult("waitlisted")}
                                    disabled={busy || !panel.sub_domain}
                                    className="inline-flex items-center gap-1.5 bg-amber-500/15 px-6 py-3 text-base font-semibold text-amber-400 ring-1 ring-inset ring-amber-500/30 transition hover:bg-amber-500/25 disabled:opacity-50"
                                >
                                    <Hourglass className="h-5 w-5" /> Waitlisted
                                </button>
                                <button
                                    onClick={markNoShow}
                                    disabled={busy}
                                    className="inline-flex items-center gap-1.5 bg-white/5 px-6 py-3 text-base font-semibold text-gray-400 ring-1 ring-inset ring-white/10 transition hover:bg-white/10 ml-auto"
                                >
                                    <UserX className="h-5 w-5" /> No Show
                                </button>
                                <button
                                    onClick={uncall}
                                    disabled={busy}
                                    title="Called the wrong recruit - send them back to waiting"
                                    className="inline-flex items-center gap-1.5 bg-white/5 px-6 py-3 text-base font-semibold text-gray-400 ring-1 ring-inset ring-white/10 transition hover:bg-white/10"
                                >
                                    <Undo2 className="h-5 w-5" /> Uncall
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="flex h-full min-h-[12rem] flex-col items-center justify-center gap-1.5 border border-white/10 bg-white/[0.02] p-6 text-center">
                        <PhoneCall className="h-6 w-6 text-gray-600" />
                        <p className="text-sm font-semibold text-gray-400">Nobody is currently being interviewed</p>
                        <p className="text-xs text-gray-600">Use Call Next in the Waiting list to bring someone here</p>
                    </div>
                )}
            </div>
        </div>
    );
}

// The ONE shared waiting list for this table's domain (migration 024, 2026-09-03): every
// table open for the same sub_domain shows this exact same pool, oldest check-in first -
// there is no "this table's own queue" any more, since nobody is assigned a table until
// they're actually called. Each row can be pulled to THIS table via the existing
// (previously cross-table-only) call-token route. Call Next itself lives in this card's
// header now (2026-09-04, moved out of TableSlot) since it claims the front of this exact
// list - the button sits right next to what it acts on. No drag-reorder - a domain-wide line
// shared live across however many tables are open isn't a single owner's order to manually
// rearrange; fairness is FIFO by check-in time instead.
function DomainWaitingPool({
    panelId,
    subDomain,
    onChanged,
    onCallNext,
    callingNext,
}: {
    panelId: string;
    subDomain: string;
    onChanged: () => void;
    onCallNext: () => void;
    callingNext: boolean;
}) {
    const [rows, setRows] = useState<DomainWaitingToken[]>([]);
    const [loading, setLoading] = useState(true);
    const [callingId, setCallingId] = useState<string | null>(null);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch(`/api/admin/recruitment/panels/waiting-by-domain?sub_domain=${subDomain}`);
            const data = await res.json();
            if (res.ok) setRows((data.data ?? []) as DomainWaitingToken[]);
        } finally {
            setLoading(false);
        }
    }, [subDomain]);

    useEffect(() => {
        load();
        const interval = setInterval(load, 5000);
        return () => clearInterval(interval);
    }, [load]);

    const callHere = async (tokenId: string) => {
        setCallingId(tokenId);
        try {
            const res = await fetch(`/api/admin/recruitment/panels/${panelId}/call-token`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ token_id: tokenId }),
            });
            const data = await res.json();
            if (res.ok) {
                toast.success(`Called #${data.token_number}: ${data.recruit?.name ?? ""}`);
                load();
                onChanged();
            } else {
                toast.error(data.error || "Could not call this recruit");
            }
        } finally {
            setCallingId(null);
        }
    };

    // min-h-0 is load-bearing here too - see TableSlot's identical comment.
    return (
        <div className="h-full min-h-0 flex flex-col border border-white/10 bg-black">
            <div className="shrink-0 flex flex-wrap items-start justify-between gap-3 px-4 py-2.5 border-b border-white/10">
                {/* Call Next in the top-left corner of this card, right next to what it
                    claims from - it pulls the oldest row below, so the button and the list
                    it acts on now sit together instead of Call Next living in a separate
                    card on the other side of the page. */}
                <button
                    type="button"
                    onClick={onCallNext}
                    disabled={callingNext}
                    className="inline-flex shrink-0 items-center gap-1.5 bg-red px-4 py-2 text-sm font-bold text-white shadow shadow-red/30 transition hover:bg-red/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                    <PhoneCall className="h-4 w-4" /> {callingNext ? "Calling..." : "Call Next"}
                </button>
                <div className="min-w-[10rem] flex-1">
                    <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <Users className="h-4 w-4 text-gray-400" /> Waiting ({rows.length})
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-500">
                        Shared across every open table for this domain. Click a name for the full profile, or call one straight to this table.
                    </p>
                </div>
            </div>
            {loading ? (
                <div className="p-5 text-center text-gray-500 text-sm">Loading...</div>
            ) : rows.length === 0 ? (
                <div className="p-5 text-center text-gray-500 text-sm">Nobody is waiting.</div>
            ) : (
                <div className="flex-1 min-h-0 overflow-y-auto p-3 space-y-1.5">
                    {rows.map((r) => (
                        <div key={r.token_id} className="border border-white/10 bg-black/20">
                            <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
                                <span className="w-10 shrink-0 font-mono text-sm text-gray-300">#{r.token_number}</span>
                                <button
                                    type="button"
                                    onClick={() => setExpandedId((id) => (id === r.token_id ? null : r.token_id))}
                                    className="min-w-0 flex-1 truncate text-left text-sm font-medium text-white hover:underline"
                                >
                                    {r.recruit?.name ?? "Unknown"}
                                </button>
                                {r.is_walkin && (
                                    <span
                                        title="Not shortlisted, walk-in"
                                        className="shrink-0 inline-flex items-center gap-1 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-400 ring-1 ring-inset ring-amber-500/30"
                                    >
                                        <Footprints className="h-3 w-3" /> Walk-in
                                    </span>
                                )}
                                <span className="shrink-0 text-xs text-gray-500">{r.recruit?.reg_no}</span>
                                <button
                                    type="button"
                                    onClick={() => callHere(r.token_id)}
                                    disabled={callingId === r.token_id}
                                    className="shrink-0 inline-flex items-center gap-1 bg-red/15 px-2.5 py-1 text-[11px] font-semibold text-red ring-1 ring-inset ring-red/40 transition hover:bg-red/25 disabled:opacity-50"
                                >
                                    <PhoneCall className="h-3 w-3" /> {callingId === r.token_id ? "Calling..." : "Call Here"}
                                </button>
                            </div>
                            {expandedId === r.token_id && r.recruit && (
                                <div className="border-t border-white/10 p-3">
                                    <RecruitProfileCard
                                        token={{
                                            token_id: r.token_id,
                                            token_number: r.token_number,
                                            recruit: r.recruit,
                                            is_walkin: r.is_walkin,
                                            review_note: r.review_note,
                                            rating: r.rating,
                                            interested_other_clubs: r.interested_other_clubs,
                                            interested_other_domains: r.interested_other_domains,
                                            review_updated_by: r.review_updated_by,
                                            review_updated_at: r.review_updated_at,
                                        }}
                                        onChanged={() => {
                                            load();
                                            onChanged();
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export default function PanelInterviewPage() {
    const ready = useRequireRole(["member", "lead", "admin"]);
    const params = useParams<{ panelId: string }>();
    const panelId = params.panelId;
    // Set when arriving via the Interview Results list's "go to panel" link
    // (?recruit=<recruit_id>) - used to surface that recruit even if they're `done` and so
    // don't otherwise appear in this page's Now Serving slot or waiting list.
    const searchParams = useSearchParams();
    const recruitParam = searchParams.get("recruit");

    const [panel, setPanel] = useState<Panel | null>(null);
    const [tokens, setTokens] = useState<QueueToken[]>([]);
    const [loading, setLoading] = useState(true);
    // True once we've confirmed this panel id no longer exists at all (deleted). A panel
    // that still exists but got paused/closed-for-day is handled separately below via
    // panel.is_active, since that's a normal, expected state, not "gone".
    const [gone, setGone] = useState(false);

    // There's no GET /api/admin/recruitment/panels/:id (the [id] route only supports
    // DELETE) - so the panel's own data is recovered by fetching the full list and finding
    // this id client-side, same as every other panel-list consumer in this app already does.
    const load = useCallback(async () => {
        try {
            const [panelsRes, queueRes] = await Promise.all([
                fetch("/api/admin/recruitment/panels"),
                fetch(`/api/admin/recruitment/panels/${panelId}/queue`),
            ]);
            const panelsData = await panelsRes.json().catch(() => ({}));
            if (panelsRes.ok) {
                const match = ((panelsData.data ?? []) as Panel[]).find((p) => p.id === panelId);
                setPanel(match ?? null);
                setGone(!match);
            } else {
                setGone(true);
            }
            const queueData = await queueRes.json().catch(() => ({}));
            if (queueRes.ok) setTokens(queueData.data ?? []);
        } catch {
            // Keep the last known state on a network hiccup - the next 5s poll retries.
        } finally {
            setLoading(false);
        }
    }, [panelId]);

    useEffect(() => {
        if (!ready) return;
        load();
        const interval = setInterval(load, 5000);
        return () => clearInterval(interval);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready, panelId]);

    // Lifted out of TableSlot (2026-09-04) so the button can render inside
    // DomainWaitingPool's header instead - it claims the front of that exact list, so it now
    // lives next to what it acts on rather than in a separate card.
    const [resuming, setResuming] = useState(false);
    const resumePanel = useCallback(async () => {
        setResuming(true);
        try {
            const res = await fetch(`/api/admin/recruitment/panels/${panelId}/reopen`, { method: "PATCH" });
            const data = await res.json();
            if (res.ok && data.reopened) {
                toast.success("Table resumed");
                load();
            } else {
                toast.error(data.error || "Could not resume table");
            }
        } finally {
            setResuming(false);
        }
    }, [panelId, load]);

    const [callingNext, setCallingNext] = useState(false);
    const callNext = useCallback(async () => {
        if (!panel) return;
        setCallingNext(true);
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
            setCallingNext(false);
            load();
        }
    }, [panel, load]);

    if (!ready) return null;

    // Only surface the banner for a status this page doesn't already show prominently -
    // `called` is already the giant Now Serving card in TableSlot, so highlighting it again
    // here would just be a duplicate of what's already on screen.
    const highlightedToken = recruitParam ? tokens.find((t) => t.recruit.id === recruitParam) ?? null : null;
    const showHighlight = Boolean(highlightedToken && highlightedToken.status !== "called");
    const recruitNotFound = Boolean(recruitParam && !loading && panel?.is_active && !highlightedToken);

    return (
        // Bounded to the viewport minus the dashboard shell's own topbar (h-16) and its
        // <main> padding (p-4 / md:p-8, top+bottom) - see AdminTopbar.tsx and
        // dashboard/layout.tsx. The shell's <main> is deliberately NOT a scroll container
        // (a comment there explains why: it would break the sticky topbar), so this page
        // can't just ask an ancestor to clip it - it has to fit its OWN height inside what's
        // left, and let its own panels scroll internally instead of growing past it.
        <div className="flex h-[calc(100vh-6rem)] md:h-[calc(100vh-8rem)] flex-col gap-4">
            <Link
                href="/dashboard/recruitment/interview"
                className="shrink-0 inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 transition hover:text-white"
            >
                <ArrowLeft className="h-3.5 w-3.5" /> Switch table
            </Link>

            {loading ? (
                <div className="p-8 text-center text-gray-500 text-sm">Loading table...</div>
            ) : gone || !panel ? (
                <div className="border border-amber-500/30 bg-black p-6 text-sm text-amber-300 space-y-3">
                    <p>This table is no longer available. It may have been deleted.</p>
                    <Link
                        href="/dashboard/recruitment/interview"
                        className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" /> Back to tables
                    </Link>
                </div>
            ) : !panel.is_active ? (
                <div className="border border-amber-500/30 bg-black p-6 text-sm text-amber-300 space-y-3">
                    <p>&quot;{panel.domain_label}&quot; was paused or closed for the day.</p>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={resumePanel}
                            disabled={resuming}
                            className="inline-flex items-center gap-1.5 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/30 transition hover:bg-emerald-500/25 disabled:opacity-50"
                        >
                            {resuming ? "Resuming..." : "Resume this table"}
                        </button>
                        <Link
                            href="/dashboard/recruitment/interview"
                            className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
                        >
                            <ArrowLeft className="h-3.5 w-3.5" /> Back to tables
                        </Link>
                    </div>
                </div>
            ) : (
                <>
                    <div className="shrink-0 flex items-center justify-between gap-3 flex-wrap">
                        <div>
                            <p className="text-xs font-bold uppercase tracking-widest text-red">
                                {subDomainFullLabel(panel.sub_domain ?? "")}
                            </p>
                            <h1 className="text-2xl font-black text-white tracking-tight">{panel.domain_label}</h1>
                        </div>
                    </div>

                    {recruitNotFound && (
                        <div className="shrink-0 border border-amber-500/30 bg-black p-4 text-sm text-amber-300">
                            Could not find that recruit on this table anymore - they may have been moved to
                            another table for this domain.
                        </div>
                    )}

                    {showHighlight && highlightedToken && (
                        <div className="shrink-0 max-h-[40vh] overflow-y-auto border border-blue-500/30 bg-blue-500/[0.06] p-4 space-y-3">
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-xs font-bold uppercase tracking-widest text-blue-400">
                                    You came here for {highlightedToken.recruit.name}
                                </p>
                                <Link
                                    href={`/dashboard/recruitment/interview/${panelId}`}
                                    className="text-xs font-semibold text-gray-400 transition hover:text-white"
                                >
                                    Hide
                                </Link>
                            </div>
                            <RecruitProfileCard token={highlightedToken} onChanged={load} />
                        </div>
                    )}

                    {/* Side by side, each half filling this row's height and scrolling its
                        own overflow internally - stacks on small screens (nothing to put
                        side by side with on a phone). */}
                    <div className="flex-1 min-h-0 grid grid-cols-1 lg:grid-cols-2 gap-4">
                        <TableSlot panel={panel} tokens={tokens} onChanged={load} />
                        {panel.sub_domain && (
                            <DomainWaitingPool
                                panelId={panel.id}
                                subDomain={panel.sub_domain}
                                onChanged={load}
                                onCallNext={callNext}
                                callingNext={callingNext}
                            />
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
