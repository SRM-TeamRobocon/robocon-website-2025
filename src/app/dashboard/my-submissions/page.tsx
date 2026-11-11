"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ListChecks, Pencil, Trash2, ArrowLeft, Clock, CheckCircle2, XCircle } from "lucide-react";
import { useRequireRole } from "@/hooks/use-require-role";
import ContentEditForm from "@/components/admin/ContentEditForm";
import { CONTENT_RESOURCES, type ContentResource } from "@/lib/content-resources";
import { Thumb, findImageField } from "@/components/ContentImageFields";

interface Submission {
    id: string;
    resource: string;
    action: "create" | "update";
    record_id: string | null;
    payload: Record<string, any>;
    status: "pending" | "approved" | "rejected";
    review_note: string | null;
    created_at: string;
    reviewed_at: string | null;
}

const STATUS_CONFIG: Record<
    Submission["status"],
    { badge: string; icon: typeof Clock }
> = {
    pending: {
        badge: "bg-amber-500/15 text-amber-400 ring-amber-500/30",
        icon: Clock,
    },
    approved: {
        badge: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
        icon: CheckCircle2,
    },
    rejected: {
        badge: "bg-red-500/15 text-red-400 ring-red-500/30",
        icon: XCircle,
    },
};

export default function MySubmissionsPage() {
    const ready = useRequireRole(["member"]);
    const [rows, setRows] = useState<Submission[]>([]);
    const [loading, setLoading] = useState(true);
    const [editingProposal, setEditingProposal] = useState<Submission | null>(null);
    const [saving, setSaving] = useState(false);
    const [withdrawingId, setWithdrawingId] = useState<string | null>(null);

    const loadSubmissions = async () => {
        try {
            const res = await fetch("/api/member/content-edits");
            const data = await res.json();
            if (data.success) {
                setRows(data.data || []);
            } else {
                toast.error(data.error || "Could not load submissions.");
            }
        } catch {
            toast.error("Failed to load submissions.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (ready) {
            loadSubmissions();
        }
    }, [ready]);

    const handleSaveProposal = async (payload: Record<string, any>) => {
        if (!editingProposal) return;
        setSaving(true);
        try {
            const res = await fetch("/api/member/content-edits", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: editingProposal.id,
                    payload,
                }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success("Proposal updated successfully");
                setEditingProposal(null);
                await loadSubmissions();
            } else {
                toast.error(data.error || "Could not update proposal");
            }
        } catch {
            toast.error("An unexpected error occurred while saving");
        } finally {
            setSaving(false);
        }
    };

    const handleWithdraw = async (id: string) => {
        if (!window.confirm("Are you sure you want to withdraw this proposed content before it is reviewed?")) {
            return;
        }
        setWithdrawingId(id);
        try {
            const res = await fetch(`/api/member/content-edits?id=${id}`, {
                method: "DELETE",
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success("Proposal withdrawn");
                setRows((prev) => prev.filter((r) => r.id !== id));
            } else {
                toast.error(data.error || "Could not withdraw proposal");
            }
        } catch {
            toast.error("An unexpected error occurred");
        } finally {
            setWithdrawingId(null);
        }
    };

    if (!ready) return null;

    if (editingProposal) {
        const config = CONTENT_RESOURCES[editingProposal.resource as ContentResource];
        if (!config) return null;

        const title =
            editingProposal.payload?.[config.primaryField] ||
            editingProposal.payload?.title ||
            editingProposal.payload?.name ||
            config.label;

        return (
            <div className="space-y-6 max-w-2xl">
                <button
                    onClick={() => setEditingProposal(null)}
                    className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition"
                >
                    <ArrowLeft className="w-4 h-4" /> Back to Submissions
                </button>

                <div className="border-b border-white/10 pb-4">
                    <span className="inline-block px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider text-amber-400 bg-amber-400/10 ring-1 ring-inset ring-amber-400/20 mb-2">
                        Pending Admin Review
                    </span>
                    <h1 className="text-2xl font-bold text-white">
                        Edit Proposal: {title}
                    </h1>
                    <p className="mt-1 text-sm text-gray-400">
                        You can modify your proposed {config.label.toLowerCase()} content here until an admin approves or rejects it.
                    </p>
                </div>

                <div className="border border-white/10 bg-black backdrop-blur-xl p-6">
                    <ContentEditForm
                        fields={config.fields}
                        initialValues={editingProposal.payload || {}}
                        submitLabel="Save Changes to Proposal"
                        submitting={saving}
                        resource={editingProposal.resource}
                        onSubmit={handleSaveProposal}
                    />
                </div>
            </div>
        );
    }

    const pendingCount = rows.filter((r) => r.status === "pending").length;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <ListChecks className="w-7 h-7 text-red" />
                        My Submissions
                    </h1>
                    <p className="mt-2 text-gray-400 text-sm">
                        Track, edit, or withdraw content you have proposed before an admin approves it.
                    </p>
                </div>

                {pendingCount > 0 && (
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold self-start sm:self-auto">
                        <Clock className="w-4 h-4" />
                        <span>{pendingCount} proposal{pendingCount === 1 ? "" : "s"} editable (pending review)</span>
                    </div>
                )}
            </div>

            <div className="border border-white/10 bg-black backdrop-blur-xl">
                {loading ? (
                    <div className="p-8 text-center text-gray-500 text-sm">Loading submissions...</div>
                ) : rows.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 text-sm">
                        No submissions yet. Propose new content from the Propose Content tab.
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-white/10">
                                    <th className="px-5 py-3">Proposed Content</th>
                                    <th className="px-5 py-3">Resource</th>
                                    <th className="px-5 py-3">Action</th>
                                    <th className="px-5 py-3">Submitted</th>
                                    <th className="px-5 py-3">Status</th>
                                    <th className="px-5 py-3">Note</th>
                                    <th className="px-5 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => {
                                    const config = CONTENT_RESOURCES[row.resource as ContentResource];
                                    const imageField = config ? findImageField(config) : null;
                                    const primaryValue =
                                        row.payload?.[config?.primaryField || "title"] ||
                                        row.payload?.title ||
                                        row.payload?.name ||
                                        "Untitled Proposal";
                                    const imageUrl = imageField ? row.payload?.[imageField.name] : null;
                                    const statusInfo = STATUS_CONFIG[row.status] || STATUS_CONFIG.pending;
                                    const StatusIcon = statusInfo.icon;
                                    const isPending = row.status === "pending";

                                    return (
                                        <tr key={row.id} className="border-b border-white/5 last:border-0 hover:bg-white/[0.02] transition">
                                            <td className="px-5 py-3">
                                                <div className="flex items-center gap-3 min-w-[180px]">
                                                    {imageUrl && (
                                                        <Thumb src={imageUrl} alt={primaryValue} />
                                                    )}
                                                    <span className="text-white font-medium line-clamp-1">
                                                        {primaryValue}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3 text-gray-300 capitalize">{config?.label || row.resource}</td>
                                            <td className="px-5 py-3 text-gray-400 capitalize">{row.action}</td>
                                            <td className="px-5 py-3 text-gray-400 whitespace-nowrap">
                                                {new Date(row.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-5 py-3 whitespace-nowrap">
                                                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold ring-1 ring-inset capitalize ${statusInfo.badge}`}>
                                                    <StatusIcon className="w-3.5 h-3.5" />
                                                    {row.status}
                                                </span>
                                            </td>
                                            <td className="px-5 py-3 text-gray-400 max-w-[200px] truncate">
                                                {row.review_note || "—"}
                                            </td>
                                            <td className="px-5 py-3 text-right whitespace-nowrap">
                                                {isPending ? (
                                                    <div className="inline-flex items-center justify-end gap-2">
                                                        <button
                                                            onClick={() => setEditingProposal(row)}
                                                            className="inline-flex items-center gap-1 px-3 py-1 bg-blue-600/20 text-blue-400 hover:bg-blue-600/30 text-xs font-semibold ring-1 ring-inset ring-blue-500/30 transition rounded-none"
                                                            title="Edit this proposed content before it is approved"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                            Edit
                                                        </button>
                                                        <button
                                                            onClick={() => handleWithdraw(row.id)}
                                                            disabled={withdrawingId === row.id}
                                                            className="inline-flex items-center gap-1 px-2.5 py-1 bg-red/10 text-red hover:bg-red/20 text-xs font-semibold ring-1 ring-inset ring-red/30 transition disabled:opacity-50"
                                                            title="Withdraw and delete this proposal"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                            {withdrawingId === row.id ? "..." : "Withdraw"}
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <span className="text-xs text-gray-500 italic">
                                                        {row.status === "approved" ? "Approved" : "Reviewed"}
                                                    </span>
                                                )}
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
