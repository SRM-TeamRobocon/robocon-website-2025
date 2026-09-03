"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import {
    ArrowLeft,
    PhoneCall,
    CheckCircle2,
    Clock3,
    UserX,
    Award,
    Star,
    Ban,
    Hourglass,
    Pencil,
    GripVertical,
    Footprints,
    ChevronDown,
    Users,
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
import { subDomainLabel, subDomainFullLabel } from "@/lib/recruit-domains";
import { travelMethodLabel } from "@/lib/travel-method";
import { genderLabel } from "@/lib/gender";
import EditRecruitModal, { type EditableRecruit } from "@/components/recruit/EditRecruitModal";

// The dedicated page for ONE interview table, reached by joining or creating a table from
// /dashboard/recruitment/interview. Everything here is scoped to a single panel_id - there
// is no cross-table calling any more (that lived in the old shared-queue board and made no
// sense once only one table is ever in view).

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
    hostel_room: string | null;
    day_scholar_area: string | null;
    travel_method: string | null;
    gender: string | null;
    phone: string | null;
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

// Same "day/month, hour:minute" shape as the picker page's own copy - a one-line formatter,
// not worth sharing a module for.
function savedAtLabel(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString([], {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
    });
}

// Verbatim copy of the finished/verified RecruitProfileCard from the old board - full
// recruit detail including the review-note/rating/interested-in-other-clubs/domains
// fields. Reused as-is for both the "Now Serving" recruit (via TableSlot) and each
// expanded waiting-list row (via PanelWaitingList) below.
function RecruitProfileCard({ token, onChanged }: { token: QueueToken; onChanged: () => void }) {
    const r = token.recruit;

    const [reviewNote, setReviewNote] = useState(token.review_note ?? "");
    const [rating, setRating] = useState(token.rating ?? "");
    const [interestedClubs, setInterestedClubs] = useState(token.interested_other_clubs ?? "");
    const [interestedDomains, setInterestedDomains] = useState(token.interested_other_domains ?? "");
    const [reviewSavedBy, setReviewSavedBy] = useState(token.review_updated_by);
    const [reviewSavedAt, setReviewSavedAt] = useState(token.review_updated_at);
    const [savingReview, setSavingReview] = useState(false);

    // Re-sync from the prop whenever it's a genuinely different token (a new recruit swapped
    // into this slot) or the server-side value moved out from under us (another panel saved
    // a note on the same token, or a background refresh landed) - without this, switching
    // "Now Serving" recruits would leave the PREVIOUS recruit's draft note lingering.
    useEffect(() => {
        setReviewNote(token.review_note ?? "");
        setRating(token.rating ?? "");
        setInterestedClubs(token.interested_other_clubs ?? "");
        setInterestedDomains(token.interested_other_domains ?? "");
        setReviewSavedBy(token.review_updated_by);
        setReviewSavedAt(token.review_updated_at);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        token.token_id,
        token.review_note,
        token.rating,
        token.interested_other_clubs,
        token.interested_other_domains,
        token.review_updated_by,
        token.review_updated_at,
    ]);

    const [editRecruit, setEditRecruit] = useState<EditableRecruit | null>(null);
    const [loadingEdit, setLoadingEdit] = useState(false);

    // RecruitProfile (the queue payload) doesn't carry `course` - the edit form requires a
    // non-empty one, so rather than open the modal with a blank course and risk a save that
    // silently wipes a real value, fetch the full recruit record on demand and only open once
    // it's in hand. Scoped by an exact reg_no match against the search results, since the
    // list endpoint's `search` is a substring match and could return more than one row.
    const openEdit = async () => {
        setLoadingEdit(true);
        try {
            const res = await fetch(`/api/admin/recruitment/recruits?search=${encodeURIComponent(r.reg_no)}`);
            const data = await res.json();
            const match = (data.data ?? []).find((x: any) => x.reg_no === r.reg_no);
            if (!res.ok || !data.success || !match) {
                toast.error("Could not load recruit for editing");
                return;
            }
            setEditRecruit({
                id: match.id,
                name: match.name,
                reg_no: match.reg_no,
                year: match.year,
                gender: match.gender,
                department: match.department,
                course: match.course,
                phone: match.phone,
                is_hosteller: match.is_hosteller,
                hostel_block: match.hostel_block,
                hostel_room: match.hostel_room,
                day_scholar_area: match.day_scholar_area,
                travel_method: match.travel_method,
                domains: match.domains,
            });
        } catch {
            toast.error("Could not load recruit for editing");
        } finally {
            setLoadingEdit(false);
        }
    };

    const saveReview = async () => {
        setSavingReview(true);
        try {
            const res = await fetch(`/api/admin/recruitment/panels/tokens/${token.token_id}/review`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    review_note: reviewNote,
                    rating: rating === "" ? null : rating,
                    interested_other_clubs: interestedClubs,
                    interested_other_domains: interestedDomains,
                }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success("Review saved");
                setReviewSavedBy(data.data.review_updated_by);
                setReviewSavedAt(data.data.review_updated_at);
                onChanged();
            } else {
                toast.error(data.error || "Could not save review");
            }
        } catch {
            toast.error("Could not save review");
        } finally {
            setSavingReview(false);
        }
    };

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
                <div className="flex shrink-0 items-center gap-1.5">
                    {r.portfolio_url && (
                        <a
                            href={r.portfolio_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="bg-blue-500/15 px-3 py-1.5 text-xs font-semibold text-blue-400 ring-1 ring-inset ring-blue-500/30 transition hover:bg-blue-500/25"
                        >
                            LinkedIn ↗
                        </a>
                    )}
                    <button
                        type="button"
                        onClick={openEdit}
                        disabled={loadingEdit}
                        title={`Edit ${r.name}`}
                        className="inline-flex items-center gap-1 bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-gray-300 ring-1 ring-inset ring-white/10 transition hover:bg-white/20 hover:text-white disabled:opacity-50"
                    >
                        <Pencil className="h-3.5 w-3.5" />
                        {loadingEdit ? "..." : "Edit"}
                    </button>
                </div>
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
                    {r.domains.length === 0 && <span className="text-xs text-gray-500">-</span>}
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

            <div>
                <div className="flex items-center justify-between gap-3 mb-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-widest text-gray-500">Review note</p>
                    <div className="flex items-center gap-1">
                        {(["good", "average", "bad"] as const).map((opt) => (
                            <button
                                key={opt}
                                type="button"
                                onClick={() => setRating(rating === opt ? "" : opt)}
                                className={`px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide ring-1 ring-inset transition ${
                                    rating === opt
                                        ? opt === "good"
                                            ? "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30"
                                            : opt === "average"
                                              ? "bg-amber-500/15 text-amber-400 ring-amber-500/30"
                                              : "bg-red-500/15 text-red-400 ring-red-500/30"
                                        : "bg-white/5 text-gray-500 ring-white/10 hover:bg-white/10 hover:text-gray-300"
                                }`}
                            >
                                {opt}
                            </button>
                        ))}
                    </div>
                </div>
                <textarea
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="Running note for other panels/leads..."
                    rows={2}
                    className="w-full border-0 bg-white/5 py-2 px-3 text-sm text-white placeholder:text-gray-500 ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500"
                />
                <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                        type="text"
                        value={interestedClubs}
                        onChange={(e) => setInterestedClubs(e.target.value)}
                        placeholder="Interested in other clubs? (optional)"
                        className="w-full border-0 bg-white/5 py-1.5 px-3 text-xs text-white placeholder:text-gray-500 ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                        type="text"
                        value={interestedDomains}
                        onChange={(e) => setInterestedDomains(e.target.value)}
                        placeholder="Interested in other domains? (optional)"
                        className="w-full border-0 bg-white/5 py-1.5 px-3 text-xs text-white placeholder:text-gray-500 ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500"
                    />
                </div>
                <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2">
                    <button
                        type="button"
                        onClick={saveReview}
                        disabled={savingReview}
                        className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1 text-xs font-semibold text-gray-300 ring-1 ring-inset ring-white/10 transition hover:bg-white/20 hover:text-white disabled:opacity-50"
                    >
                        {savingReview ? "Saving..." : "Save"}
                    </button>
                    {reviewSavedBy && (
                        <p className="text-[10px] text-gray-500">
                            Last saved by {reviewSavedBy}
                            {reviewSavedAt ? ` at ${savedAtLabel(reviewSavedAt)}` : ""}
                        </p>
                    )}
                </div>
            </div>

            {editRecruit && (
                <EditRecruitModal
                    recruit={editRecruit}
                    onClose={() => setEditRecruit(null)}
                    onSaved={() => {
                        setEditRecruit(null);
                        onChanged();
                    }}
                />
            )}
        </div>
    );
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

// This table's "Now Serving" slot (the `called` token, rendered big via RecruitProfileCard),
// Call Next, and inline result-logging (Selected/Rejected/Waitlisted). Reused from the old
// board unchanged in data-fetching/API calls and prop signature - only its layout/sizing is
// bumped here (larger text, more padding) since it's now the single centerpiece of a whole
// page instead of one card among many.
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
        <div className="border border-white/10 bg-black p-6 space-y-4">
            <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="min-w-0">
                    <h3 className="truncate text-lg font-bold text-white">{panel.domain_label}</h3>
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
                        </div>
                    </div>
                </div>
            ) : (
                <button
                    onClick={callNext}
                    disabled={busy || waitingCount === 0}
                    className="group relative w-full overflow-hidden inline-flex items-center justify-center bg-red px-6 py-4 text-base font-bold text-white shadow-lg shadow-red/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-red/40 active:translate-y-0 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:pointer-events-none"
                    style={{ clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)" }}
                >
                    <span
                        className="absolute inset-0 -translate-x-full transition-transform duration-200 ease-out group-hover:translate-x-0"
                        style={{ clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)", backgroundColor: "#D4AF37" }}
                    />
                    <span className="relative inline-flex items-center gap-2 transition-colors duration-200 group-hover:text-black">
                        <PhoneCall className="h-5 w-5" /> Call Next
                    </span>
                </button>
            )}
        </div>
    );
}

// One row inside this table's own waiting list - drag handle + token number + name +
// expand-to-RecruitProfileCard, matching SortableSharedRow's visual conventions for those
// parts (the old board's per-domain shared queue). No "Call to X" buttons here: there is
// only ever one table in view now, so there is nothing else to call this recruit to.
function WaitingRow({ token, onChanged }: { token: QueueToken; onChanged: () => void }) {
    const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
        id: token.token_id,
    });
    const style = {
        transform: CSS.Transform.toString(transform),
        transition,
        opacity: isDragging ? 0.5 : 1,
    };
    const [expanded, setExpanded] = useState(false);

    return (
        <div ref={setNodeRef} style={style} className="border border-white/10 bg-black/20">
            <div className="flex flex-wrap items-center gap-2 px-3 py-2.5">
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
                <button
                    type="button"
                    onClick={() => setExpanded((e) => !e)}
                    className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
                    aria-expanded={expanded}
                    aria-label={expanded ? "Collapse profile" : "Expand profile"}
                >
                    <ChevronDown
                        className={`h-3.5 w-3.5 shrink-0 text-gray-500 transition-transform duration-150 ${expanded ? "" : "-rotate-90"}`}
                    />
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-white">{token.recruit.name}</span>
                </button>
                {token.is_walkin && (
                    <span
                        title="Not shortlisted, walk-in"
                        className="shrink-0 inline-flex items-center gap-1 bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-400 ring-1 ring-inset ring-amber-500/30"
                    >
                        <Footprints className="h-3 w-3" /> Walk-in
                    </span>
                )}
                <span className="shrink-0 text-xs text-gray-500">{token.recruit.reg_no}</span>
            </div>
            {expanded && (
                <div className="border-t border-white/10 p-3">
                    <RecruitProfileCard token={token} onChanged={onChanged} />
                </div>
            )}
        </div>
    );
}

// This table's own waiting list - tokens are already scoped to one panel_id (fetched via
// GET .../panels/:id/queue), so this just filters to `waiting`, sorts by queue_position, and
// wires up drag-reorder against the same endpoint the old shared queue used, scoped to this
// panel. Replaces SortableSharedRow + SharedWaitingQueue (cross-table, removed - there's
// nothing to call to any more).
function PanelWaitingList({ panelId, tokens, onChanged }: { panelId: string; tokens: QueueToken[]; onChanged: () => void }) {
    const waiting = tokens.filter((t) => t.status === "waiting").sort((a, b) => a.queue_position - b.queue_position);
    const dragSensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

    const handleDragEnd = async (event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;

        const oldIndex = waiting.findIndex((t) => t.token_id === active.id);
        const newIndex = waiting.findIndex((t) => t.token_id === over.id);
        if (oldIndex === -1 || newIndex === -1) return;

        const reordered = arrayMove(waiting, oldIndex, newIndex);
        const movedToken = reordered[newIndex];
        const afterToken = newIndex > 0 ? reordered[newIndex - 1] : null;

        try {
            const res = await fetch(`/api/admin/recruitment/panels/${panelId}/tokens/${movedToken.token_id}/reorder`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ after_token_id: afterToken ? afterToken.token_id : null }),
            });
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
                    <Users className="h-4 w-4 text-gray-400" /> Waiting ({waiting.length})
                </h3>
                <p className="mt-0.5 text-xs text-gray-500">Drag to reorder. Click a row to expand the full profile.</p>
            </div>
            {waiting.length === 0 ? (
                <div className="p-5 text-center text-gray-500 text-sm">Nobody is waiting.</div>
            ) : (
                <DndContext sensors={dragSensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
                    <SortableContext items={waiting.map((t) => t.token_id)} strategy={verticalListSortingStrategy}>
                        <div className="p-3 space-y-1.5">
                            {waiting.map((t) => (
                                <WaitingRow key={t.token_id} token={t} onChanged={onChanged} />
                            ))}
                        </div>
                    </SortableContext>
                </DndContext>
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

    if (!ready) return null;

    // Only surface the banner for a status this page doesn't already show prominently -
    // `called` is already the giant Now Serving card in TableSlot, so highlighting it again
    // here would just be a duplicate of what's already on screen.
    const highlightedToken = recruitParam ? tokens.find((t) => t.recruit.id === recruitParam) ?? null : null;
    const showHighlight = Boolean(highlightedToken && highlightedToken.status !== "called");
    const recruitNotFound = Boolean(recruitParam && !loading && panel?.is_active && !highlightedToken);

    return (
        <div className="space-y-6">
            <Link
                href="/dashboard/recruitment/interview"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 transition hover:text-white"
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
                    <Link
                        href="/dashboard/recruitment/interview"
                        className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
                    >
                        <ArrowLeft className="h-3.5 w-3.5" /> Back to tables
                    </Link>
                </div>
            ) : (
                <>
                    <div>
                        <p className="text-xs font-bold uppercase tracking-widest text-red">
                            {subDomainFullLabel(panel.sub_domain ?? "")}
                        </p>
                        <h1 className="text-3xl font-black text-white tracking-tight">{panel.domain_label}</h1>
                    </div>

                    {recruitNotFound && (
                        <div className="border border-amber-500/30 bg-black p-4 text-sm text-amber-300">
                            Could not find that recruit on this table anymore - they may have been moved to
                            another table for this domain.
                        </div>
                    )}

                    {showHighlight && highlightedToken && (
                        <div className="border border-blue-500/30 bg-blue-500/[0.06] p-4 space-y-3">
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

                    <TableSlot panel={panel} tokens={tokens} onChanged={load} />
                    <PanelWaitingList panelId={panel.id} tokens={tokens} onChanged={load} />
                </>
            )}
        </div>
    );
}
