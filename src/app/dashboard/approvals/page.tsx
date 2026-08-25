"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { ClipboardCheck, UserCheck, Check, X, Newspaper, EyeOff, Trash2, Pencil, CalendarOff } from "lucide-react";
import { useRequireRole } from "@/hooks/use-require-role";
import { getContentResource } from "@/lib/content-resources";
import { Thumb, findImageField } from "@/components/ContentImageFields";
import type { BlogBlock, BlogVisibility } from "@/lib/blog";

interface PendingMember {
    id: string;
    name: string;
    email: string;
    domain: string;
    reg_no: string;
    department: string;
    course: string;
    phone: string | null;
    created_at: string;
}

interface ApprovedMember {
    id: string;
    name: string;
    email: string;
    domain: string;
    role: "member" | "lead" | "admin";
    approved_at: string;
}

interface UnlinkedRoster {
    id: string;
    name: string;
    role: string;
    domain: string | null;
}

interface Submission {
    id: string;
    resource: string;
    action: string;
    payload: Record<string, any>;
    created_at: string;
    member_accounts: { name: string; email: string } | null;
}

interface LeaveRequestRow {
    id: string;
    owner_name: string;
    domain: string | null;
    start_date: string;
    end_date: string;
    start_time: string | null;
    end_time: string | null;
    reason: string;
    created_at: string;
    member_accounts: { name: string; email: string } | null;
}

function MembersTab() {
    const [pending, setPending] = useState<PendingMember[]>([]);
    const [approved, setApproved] = useState<ApprovedMember[]>([]);
    const [unlinked, setUnlinked] = useState<UnlinkedRoster[]>([]);
    const [mergeSelections, setMergeSelections] = useState<Record<string, string>>({});
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/member-approvals");
            const data = await res.json();
            if (data.success) {
                setPending(data.pending);
                setApproved(data.approved);
                setUnlinked(data.unlinked || []);
            }
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const approve = async (id: string) => {
        setBusyId(id);
        try {
            const res = await fetch("/api/admin/member-approvals", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id }),
            });
            if (res.ok) load();
        } finally {
            setBusyId(null);
        }
    };

    const merge = async (id: string) => {
        const mergeIntoRosterId = mergeSelections[id];
        if (!mergeIntoRosterId) {
            toast.error("Pick an existing member to merge into first");
            return;
        }
        setBusyId(id);
        try {
            const res = await fetch("/api/admin/member-approvals", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, mergeIntoRosterId }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success("Merged");
                load();
            } else {
                toast.error(data.error || "Could not merge");
            }
        } finally {
            setBusyId(null);
        }
    };

    const reject = async (id: string) => {
        if (!confirm("Reject and delete this signup? This cannot be undone.")) return;
        setBusyId(id);
        try {
            const res = await fetch(`/api/admin/member-approvals?id=${id}`, { method: "DELETE" });
            if (res.ok) setPending((prev) => prev.filter((r) => r.id !== id));
        } finally {
            setBusyId(null);
        }
    };

    const changeRole = async (id: string, role: string) => {
        setBusyId(id);
        try {
            const res = await fetch("/api/admin/member-approvals", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, role }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setApproved((prev) => prev.map((a) => (a.id === id ? { ...a, role: role as ApprovedMember["role"] } : a)));
                toast.success("Role updated");
            } else {
                toast.error(data.error || "Could not update role");
            }
        } finally {
            setBusyId(null);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500 text-sm">Loading...</div>;

    return (
        <div className="space-y-8">
            <div>
                <h2 className="text-lg font-bold text-white mb-3">Pending Signups</h2>
                <div className="bg-white/10 p-px" style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}>
                <div
                    className="h-full w-full bg-white/[0.03] backdrop-blur-xl"
                    style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
                >
                    {pending.length === 0 ? (
                        <div className="p-6 text-center text-gray-500 text-sm">No pending approvals.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-white/10">
                                        <th className="px-5 py-3">Name</th>
                                        <th className="px-5 py-3">Email</th>
                                        <th className="px-5 py-3">Domain</th>
                                        <th className="px-5 py-3">Reg No</th>
                                        <th className="px-5 py-3">Dept / Course</th>
                                        <th className="px-5 py-3">Merge into existing</th>
                                        <th className="px-5 py-3 text-right">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {pending.map((row) => (
                                        <tr key={row.id} className="border-b border-white/5 last:border-0">
                                            <td className="px-5 py-3 text-white font-medium">{row.name}</td>
                                            <td className="px-5 py-3 text-gray-300">{row.email}</td>
                                            <td className="px-5 py-3 text-gray-300">{row.domain}</td>
                                            <td className="px-5 py-3 text-gray-300">{row.reg_no}</td>
                                            <td className="px-5 py-3 text-gray-300">
                                                {row.department} / {row.course}
                                            </td>
                                            <td className="px-5 py-3">
                                                <select
                                                    value={mergeSelections[row.id] || ""}
                                                    onChange={(e) => setMergeSelections((prev) => ({ ...prev, [row.id]: e.target.value }))}
                                                    className="border-0 bg-white/5 py-1.5 px-3 text-white text-xs ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500 max-w-[180px]"
                                                >
                                                    <option value="" className="bg-gray-900">Not on old roster</option>
                                                    {unlinked.map((u) => (
                                                        <option key={u.id} value={u.id} className="bg-gray-900">
                                                            {u.name} — {u.role}
                                                        </option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-5 py-3">
                                                <div className="flex justify-end gap-2">
                                                    {mergeSelections[row.id] ? (
                                                        <button
                                                            onClick={() => merge(row.id)}
                                                            disabled={busyId === row.id}
                                                            className="inline-flex items-center gap-1.5 bg-blue-500/15 text-blue-400 ring-1 ring-inset ring-blue-500/30 px-3 py-1.5 text-xs font-semibold hover:bg-blue-500/25 disabled:opacity-50 transition"
                                                        >
                                                            <Check className="w-3.5 h-3.5" /> Merge
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => approve(row.id)}
                                                            disabled={busyId === row.id}
                                                            className="inline-flex items-center gap-1.5 bg-emerald-500/15 text-emerald-400 ring-1 ring-inset ring-emerald-500/30 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-500/25 disabled:opacity-50 transition"
                                                        >
                                                            <Check className="w-3.5 h-3.5" /> Approve as New
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => reject(row.id)}
                                                        disabled={busyId === row.id}
                                                        className="inline-flex items-center gap-1.5 bg-red-500/15 text-red-400 ring-1 ring-inset ring-red-500/30 px-3 py-1.5 text-xs font-semibold hover:bg-red-500/25 disabled:opacity-50 transition"
                                                    >
                                                        <X className="w-3.5 h-3.5" /> Reject
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                </div>
            </div>

            <div>
                <h2 className="text-lg font-bold text-white mb-3">Approved Accounts</h2>
                <div className="bg-white/10 p-px" style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}>
                <div
                    className="h-full w-full bg-white/[0.03] backdrop-blur-xl"
                    style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
                >
                    {approved.length === 0 ? (
                        <div className="p-6 text-center text-gray-500 text-sm">No approved accounts yet.</div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-left text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-white/10">
                                        <th className="px-5 py-3">Name</th>
                                        <th className="px-5 py-3">Email</th>
                                        <th className="px-5 py-3">Domain</th>
                                        <th className="px-5 py-3">Role</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {approved.map((row) => (
                                        <tr key={row.id} className="border-b border-white/5 last:border-0">
                                            <td className="px-5 py-3 text-white font-medium">{row.name}</td>
                                            <td className="px-5 py-3 text-gray-300">{row.email}</td>
                                            <td className="px-5 py-3 text-gray-300">{row.domain}</td>
                                            <td className="px-5 py-3">
                                                <select
                                                    value={row.role}
                                                    disabled={busyId === row.id}
                                                    onChange={(e) => changeRole(row.id, e.target.value)}
                                                    className="border-0 bg-white/5 py-1.5 px-3 text-white text-xs ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value="member" className="bg-gray-900">member</option>
                                                    <option value="lead" className="bg-gray-900">lead</option>
                                                    <option value="admin" className="bg-gray-900">admin</option>
                                                </select>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
                </div>
            </div>
        </div>
    );
}

function ContentTab() {
    const [rows, setRows] = useState<Submission[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/content-edits?status=pending");
            const data = await res.json();
            if (data.success) setRows(data.data);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const decide = async (id: string, decision: "approve" | "reject") => {
        setBusyId(id);
        try {
            const res = await fetch("/api/admin/content-edits", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, decision }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setRows((prev) => prev.filter((r) => r.id !== id));
                toast.success(decision === "approve" ? "Approved and published" : "Rejected");
            } else {
                toast.error(data.error || "Could not record decision");
            }
        } finally {
            setBusyId(null);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500 text-sm">Loading...</div>;

    return (
        <div className="bg-white/10 p-px" style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}>
        <div
            className="h-full w-full bg-white/[0.03] backdrop-blur-xl"
            style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
        >
            {rows.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">Nothing pending.</div>
            ) : (
                <ul className="divide-y divide-white/5">
                    {rows.map((row) => {
                        const config = getContentResource(row.resource);
                        const imageField = config && findImageField(config);
                        const imageUrl = imageField ? row.payload?.[imageField.name] : null;

                        return (
                        <li key={row.id} className="px-5 py-4">
                            <div className="flex items-center justify-between gap-4">
                                <div className="flex min-w-0 items-center gap-3">
                                    {imageUrl && <Thumb src={imageUrl} alt={`${row.resource} preview`} />}
                                    <div className="min-w-0">
                                        <p className="text-white font-medium capitalize">
                                            {row.action} — {row.resource}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {row.member_accounts?.name} ({row.member_accounts?.email}) ·{" "}
                                            {new Date(row.created_at).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                                        className="bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition"
                                    >
                                        {expanded === row.id ? "Hide" : "View"}
                                    </button>
                                    <button
                                        onClick={() => decide(row.id, "approve")}
                                        disabled={busyId === row.id}
                                        className="inline-flex items-center gap-1.5 bg-emerald-500/15 text-emerald-400 ring-1 ring-inset ring-emerald-500/30 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-500/25 disabled:opacity-50 transition"
                                    >
                                        <Check className="w-3.5 h-3.5" /> Approve
                                    </button>
                                    <button
                                        onClick={() => decide(row.id, "reject")}
                                        disabled={busyId === row.id}
                                        className="inline-flex items-center gap-1.5 bg-red-500/15 text-red-400 ring-1 ring-inset ring-red-500/30 px-3 py-1.5 text-xs font-semibold hover:bg-red-500/25 disabled:opacity-50 transition"
                                    >
                                        <X className="w-3.5 h-3.5" /> Reject
                                    </button>
                                </div>
                            </div>

                            {expanded === row.id && (
                                <pre className="mt-3 bg-black/40 border border-white/10 p-4 text-xs text-gray-300 overflow-x-auto">
                                    {JSON.stringify(row.payload, null, 2)}
                                </pre>
                            )}
                        </li>
                        );
                    })}
                </ul>
            )}
        </div>
        </div>
    );
}

function formatLeaveWindow(row: LeaveRequestRow): string {
    const dateRange =
        row.start_date === row.end_date
            ? new Date(row.start_date).toLocaleDateString()
            : `${new Date(row.start_date).toLocaleDateString()} – ${new Date(row.end_date).toLocaleDateString()}`;
    const timeRange = row.start_time && row.end_time ? `, ${row.start_time}–${row.end_time}` : " (full day)";
    return `${dateRange}${timeRange}`;
}

function LeaveTab() {
    const [rows, setRows] = useState<LeaveRequestRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/leave-requests?status=pending");
            const data = await res.json();
            if (data.success) setRows(data.data);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const decide = async (id: string, decision: "approve" | "reject") => {
        setBusyId(id);
        try {
            const res = await fetch("/api/admin/leave-requests", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, decision }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setRows((prev) => prev.filter((r) => r.id !== id));
                toast.success(decision === "approve" ? "Leave approved" : "Leave rejected");
            } else {
                toast.error(data.error || "Could not record decision");
            }
        } finally {
            setBusyId(null);
        }
    };

    if (loading) return <div className="p-8 text-center text-gray-500 text-sm">Loading...</div>;

    return (
        <div className="bg-white/10 p-px" style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}>
        <div
            className="h-full w-full bg-white/[0.03] backdrop-blur-xl"
            style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
        >
            {rows.length === 0 ? (
                <div className="p-8 text-center text-gray-500 text-sm">Nothing pending.</div>
            ) : (
                <ul className="divide-y divide-white/5">
                    {rows.map((row) => (
                        <li key={row.id} className="px-5 py-4">
                            <div className="flex items-center justify-between gap-4">
                                <div className="min-w-0">
                                    <p className="text-white font-medium">
                                        {row.owner_name} {row.domain ? `(${row.domain})` : ""}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {formatLeaveWindow(row)} · {row.member_accounts?.email}
                                    </p>
                                    <p className="mt-1 text-sm text-gray-300">{row.reason}</p>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <button
                                        onClick={() => decide(row.id, "approve")}
                                        disabled={busyId === row.id}
                                        className="inline-flex items-center gap-1.5 bg-emerald-500/15 text-emerald-400 ring-1 ring-inset ring-emerald-500/30 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-500/25 disabled:opacity-50 transition"
                                    >
                                        <Check className="w-3.5 h-3.5" /> Approve
                                    </button>
                                    <button
                                        onClick={() => decide(row.id, "reject")}
                                        disabled={busyId === row.id}
                                        className="inline-flex items-center gap-1.5 bg-red-500/15 text-red-400 ring-1 ring-inset ring-red-500/30 px-3 py-1.5 text-xs font-semibold hover:bg-red-500/25 disabled:opacity-50 transition"
                                    >
                                        <X className="w-3.5 h-3.5" /> Reject
                                    </button>
                                </div>
                            </div>
                        </li>
                    ))}
                </ul>
            )}
        </div>
        </div>
    );
}

interface BlogSubmission {
    id: string;
    title: string;
    cover_image_url: string | null;
    content: BlogBlock[];
    visibility: BlogVisibility;
    author_name: string;
    author_username: string;
    created_at: string;
}

function BlogsTab() {
    const [rows, setRows] = useState<BlogSubmission[]>([]);
    const [view, setView] = useState<"pending" | "approved">("pending");
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);
    const [expanded, setExpanded] = useState<string | null>(null);

    const load = useCallback(async (status: "pending" | "approved") => {
        setLoading(true);
        try {
            const res = await fetch(`/api/admin/blogs?status=${status}`);
            const data = await res.json();
            setRows(data.success ? data.data : []);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load(view);
    }, [load, view]);

    const decide = async (id: string, decision: "approve" | "reject" | "unpublish") => {
        setBusyId(id);
        try {
            const res = await fetch("/api/admin/blogs", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id, decision }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setRows((prev) => prev.filter((r) => r.id !== id));
                toast.success(
                    decision === "approve" ? "Approved and published"
                        : decision === "reject" ? "Rejected"
                        : "Unpublished — back in the pending queue"
                );
            } else {
                toast.error(data.error || "Could not record decision");
            }
        } finally {
            setBusyId(null);
        }
    };

    const remove = async (row: BlogSubmission) => {
        if (!confirm(`Permanently delete "${row.title}" by ${row.author_name}? This cannot be undone.`)) return;
        setBusyId(row.id);
        try {
            const res = await fetch(`/api/admin/blogs?id=${row.id}`, { method: "DELETE" });
            const data = await res.json();
            if (res.ok && data.success) {
                setRows((prev) => prev.filter((r) => r.id !== row.id));
                toast.success("Blog deleted");
            } else {
                toast.error(data.error || "Could not delete blog");
            }
        } finally {
            setBusyId(null);
        }
    };

    const tabs = (
        <div className="mb-4 flex flex-wrap gap-2">
            {(["pending", "approved"] as const).map((v) => (
                <button
                    key={v}
                    onClick={() => setView(v)}
                    className={`px-3 py-1.5 text-xs font-semibold transition ${
                        view === v ? "bg-red/15 text-white ring-1 ring-inset ring-red/40" : "text-gray-400 hover:bg-white/5"
                    }`}
                >
                    {v === "pending" ? "Pending review" : "Live posts"}
                </button>
            ))}
        </div>
    );

    return (
        <div>
            {tabs}
            <div className="bg-white/10 p-px" style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}>
            <div
                className="h-full w-full bg-white/[0.03] backdrop-blur-xl"
                style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
            >
                {loading ? (
                    <div className="p-8 text-center text-gray-500 text-sm">Loading...</div>
                ) : rows.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 text-sm">
                        {view === "pending" ? "Nothing pending." : "No live blogs."}
                    </div>
                ) : (
                    <ul className="divide-y divide-white/5">
                        {rows.map((row) => (
                            <li key={row.id} className="px-5 py-4">
                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                                    <div className="flex min-w-0 items-center gap-3">
                                        {row.cover_image_url && <Thumb src={row.cover_image_url} alt={row.title} />}
                                        <div className="min-w-0">
                                            <p className="break-words font-medium text-white">
                                                {row.title}{" "}
                                                <span className="text-xs font-normal capitalize text-gray-500">({row.visibility})</span>
                                            </p>
                                            <p className="text-xs text-gray-500">
                                                {row.author_name} ({row.author_username}) · {new Date(row.created_at).toLocaleString()}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0 flex-wrap items-center gap-2">
                                        <button
                                            onClick={() => setExpanded(expanded === row.id ? null : row.id)}
                                            className="bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
                                        >
                                            {expanded === row.id ? "Hide" : "View"}
                                        </button>
                                        <Link
                                            href={`/dashboard/blogs/edit/${row.id}`}
                                            className="inline-flex items-center gap-1.5 bg-blue-500/15 px-3 py-1.5 text-xs font-semibold text-blue-400 ring-1 ring-inset ring-blue-500/30 transition hover:bg-blue-500/25"
                                        >
                                            <Pencil className="h-3.5 w-3.5" /> Edit
                                        </Link>

                                        {view === "pending" ? (
                                            <>
                                                <button
                                                    onClick={() => decide(row.id, "approve")}
                                                    disabled={busyId === row.id}
                                                    className="inline-flex items-center gap-1.5 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/30 transition hover:bg-emerald-500/25 disabled:opacity-50"
                                                >
                                                    <Check className="h-3.5 w-3.5" /> Approve
                                                </button>
                                                <button
                                                    onClick={() => decide(row.id, "reject")}
                                                    disabled={busyId === row.id}
                                                    className="inline-flex items-center gap-1.5 bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-400 ring-1 ring-inset ring-red-500/30 transition hover:bg-red-500/25 disabled:opacity-50"
                                                >
                                                    <X className="h-3.5 w-3.5" /> Reject
                                                </button>
                                            </>
                                        ) : (
                                            <button
                                                onClick={() => decide(row.id, "unpublish")}
                                                disabled={busyId === row.id}
                                                className="inline-flex items-center gap-1.5 bg-amber-500/15 px-3 py-1.5 text-xs font-semibold text-amber-400 ring-1 ring-inset ring-amber-500/30 transition hover:bg-amber-500/25 disabled:opacity-50"
                                            >
                                                <EyeOff className="h-3.5 w-3.5" /> Unpublish
                                            </button>
                                        )}

                                        <button
                                            onClick={() => remove(row)}
                                            disabled={busyId === row.id}
                                            className="inline-flex items-center gap-1.5 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-400 ring-1 ring-inset ring-white/10 transition hover:bg-red-500/20 hover:text-red-400 disabled:opacity-50"
                                        >
                                            <Trash2 className="h-3.5 w-3.5" /> Delete
                                        </button>
                                    </div>
                                </div>

                                {expanded === row.id && (
                                    <div className="mt-3 space-y-3 border border-white/10 bg-black/40 p-4 text-sm text-gray-300">
                                        {row.content.map((block, i) => {
                                            if (block.type === "heading") return <p key={i} className="font-bold text-white">{block.text}</p>;
                                            if (block.type === "paragraph") return <p key={i} className="whitespace-pre-wrap break-words">{block.text}</p>;
                                            if (block.type === "image")
                                                // eslint-disable-next-line @next/next/no-img-element
                                                return <img key={i} src={block.url} alt={block.caption || ""} className="max-h-64 border border-white/10 object-cover" />;
                                            return null;
                                        })}
                                    </div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>
            </div>
        </div>
    );
}

export default function ApprovalsPage() {
    const ready = useRequireRole(["lead", "admin"]);
    const [tab, setTab] = useState<"members" | "content" | "blogs" | "leave">("members");

    if (!ready) return null;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                    <ClipboardCheck className="w-7 h-7 text-red" />
                    Review &amp; Approvals
                </h1>
                <p className="mt-2 text-gray-400 text-sm max-w-xl">
                    New member signups, role changes, proposed content, and blog posts — all in one place.
                </p>
            </div>

            <div className="flex gap-2">
                <button
                    onClick={() => setTab("members")}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition ${
                        tab === "members" ? "bg-red/15 text-white ring-1 ring-inset ring-red/40" : "text-gray-400 hover:bg-white/5"
                    }`}
                >
                    <UserCheck className="w-4 h-4" /> Members
                </button>
                <button
                    onClick={() => setTab("content")}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition ${
                        tab === "content" ? "bg-red/15 text-white ring-1 ring-inset ring-red/40" : "text-gray-400 hover:bg-white/5"
                    }`}
                >
                    <ClipboardCheck className="w-4 h-4" /> Content
                </button>
                <button
                    onClick={() => setTab("blogs")}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition ${
                        tab === "blogs" ? "bg-red/15 text-white ring-1 ring-inset ring-red/40" : "text-gray-400 hover:bg-white/5"
                    }`}
                >
                    <Newspaper className="w-4 h-4" /> Blogs
                </button>
                <button
                    onClick={() => setTab("leave")}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition ${
                        tab === "leave" ? "bg-red/15 text-white ring-1 ring-inset ring-red/40" : "text-gray-400 hover:bg-white/5"
                    }`}
                >
                    <CalendarOff className="w-4 h-4" /> Leave
                </button>
            </div>

            {tab === "members" ? (
                <MembersTab />
            ) : tab === "content" ? (
                <ContentTab />
            ) : tab === "blogs" ? (
                <BlogsTab />
            ) : (
                <LeaveTab />
            )}
        </div>
    );
}
