"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Footprints, Pencil, Star } from "lucide-react";
import { subDomainLabel } from "@/lib/recruit-domains";
import { travelMethodLabel } from "@/lib/travel-method";
import { genderLabel } from "@/lib/gender";
import EditRecruitModal, { type EditableRecruit } from "@/components/recruit/EditRecruitModal";

// Extracted 2026-09-04 from the interview [panelId] page into a shared component - the
// Interview Results list (interview/page.tsx) needed the exact same card for its "edit on
// the spot" modal, and a second hand-copy would drift out of sync with this one exactly like
// EMPTY_PROFILE/TOKEN_COLUMNS did across the panels API routes earlier this session. Any
// caller with a token-shaped object (queue tokens, shared-pool tokens, or one assembled from
// an interview-results row) can use this - RecruitProfileCardToken only needs the fields
// this card actually renders, not a full QueueToken.

export interface RecruitProfile {
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

export interface RecruitProfileCardToken {
    token_id: string;
    token_number: number;
    is_walkin: boolean;
    recruit: RecruitProfile;
    review_note: string | null;
    rating: "bad" | "average" | "good" | null;
    interested_other_clubs: string | null;
    interested_other_domains: string | null;
    review_updated_by: string | null;
    review_updated_at: string | null;
}

// "day/month, hour:minute" - just for the "Last saved by X at ..." attribution line.
export function savedAtLabel(iso: string): string {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    return d.toLocaleString([], {
        day: "numeric",
        month: "short",
        hour: "numeric",
        minute: "2-digit",
    });
}

export default function RecruitProfileCard({
    token,
    onChanged,
}: {
    token: RecruitProfileCardToken;
    onChanged: () => void;
}) {
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
    // recruits would leave the PREVIOUS recruit's draft note lingering.
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
