"use client";

import { useEffect, useState } from "react";
import { ListChecks } from "lucide-react";
import { useRequireRole } from "@/hooks/use-require-role";

interface Submission {
    id: string;
    resource: string;
    action: string;
    status: "pending" | "approved" | "rejected";
    review_note: string | null;
    created_at: string;
    reviewed_at: string | null;
}

const STATUS_STYLES: Record<Submission["status"], string> = {
    pending: "bg-amber-500/15 text-amber-400 ring-amber-500/30",
    approved: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
    rejected: "bg-red-500/15 text-red-400 ring-red-500/30",
};

// A `border` doesn't render along a clip-path's angled edge, so the border is faked with
// a `::before` pseudo-element instead: same clip-path, inset -1px so its color peeks out
// uniformly around the real box, including along the diagonal cut corner.
const CARD_CLIP = "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)";

export default function MySubmissionsPage() {
    const ready = useRequireRole(["member"]);
    const [rows, setRows] = useState<Submission[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetch("/api/member/content-edits")
            .then((res) => res.json())
            .then((data) => setRows(data.data || []))
            .finally(() => setLoading(false));
    }, []);

    if (!ready) return null;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                    <ListChecks className="w-7 h-7 text-red" />
                    My Submissions
                </h1>
                <p className="mt-2 text-gray-400 text-sm">Status of everything you've proposed.</p>
            </div>

            <div className="bg-white/10 p-px" style={{ clipPath: CARD_CLIP }}>
            <div
                className="h-full w-full bg-white/[0.03] backdrop-blur-xl"
                style={{ clipPath: CARD_CLIP }}
            >
                {loading ? (
                    <div className="p-8 text-center text-gray-500 text-sm">Loading...</div>
                ) : rows.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 text-sm">No submissions yet.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-white/10">
                                    <th className="px-5 py-3">Resource</th>
                                    <th className="px-5 py-3">Action</th>
                                    <th className="px-5 py-3">Submitted</th>
                                    <th className="px-5 py-3">Status</th>
                                    <th className="px-5 py-3">Note</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.id} className="border-b border-white/5 last:border-0">
                                        <td className="px-5 py-3 text-white capitalize">{row.resource}</td>
                                        <td className="px-5 py-3 text-gray-300 capitalize">{row.action}</td>
                                        <td className="px-5 py-3 text-gray-300">{new Date(row.created_at).toLocaleDateString()}</td>
                                        <td className="px-5 py-3">
                                            <span className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold ring-1 ring-inset capitalize ${STATUS_STYLES[row.status]}`}>
                                                {row.status}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-gray-400">{row.review_note || "—"}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
            </div>
        </div>
    );
}
