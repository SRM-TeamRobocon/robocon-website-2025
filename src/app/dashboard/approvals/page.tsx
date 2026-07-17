"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ClipboardCheck, UserCheck, Check, X } from "lucide-react";
import { useRequireRole } from "@/hooks/use-require-role";
import { getContentResource } from "@/lib/content-resources";
import { Thumb, findImageField } from "@/components/ContentImageFields";

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
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden">
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
                                                    className="rounded-lg border-0 bg-white/5 py-1.5 px-3 text-white text-xs ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500 max-w-[180px]"
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
                                                            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-500/15 text-blue-400 ring-1 ring-inset ring-blue-500/30 px-3 py-1.5 text-xs font-semibold hover:bg-blue-500/25 disabled:opacity-50 transition"
                                                        >
                                                            <Check className="w-3.5 h-3.5" /> Merge
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => approve(row.id)}
                                                            disabled={busyId === row.id}
                                                            className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 ring-1 ring-inset ring-emerald-500/30 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-500/25 disabled:opacity-50 transition"
                                                        >
                                                            <Check className="w-3.5 h-3.5" /> Approve as New
                                                        </button>
                                                    )}
                                                    <button
                                                        onClick={() => reject(row.id)}
                                                        disabled={busyId === row.id}
                                                        className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/15 text-red-400 ring-1 ring-inset ring-red-500/30 px-3 py-1.5 text-xs font-semibold hover:bg-red-500/25 disabled:opacity-50 transition"
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

            <div>
                <h2 className="text-lg font-bold text-white mb-3">Approved Accounts</h2>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden">
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
                                                    className="rounded-lg border-0 bg-white/5 py-1.5 px-3 text-white text-xs ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500"
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
        <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden">
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
                                        className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition"
                                    >
                                        {expanded === row.id ? "Hide" : "View"}
                                    </button>
                                    <button
                                        onClick={() => decide(row.id, "approve")}
                                        disabled={busyId === row.id}
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-500/15 text-emerald-400 ring-1 ring-inset ring-emerald-500/30 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-500/25 disabled:opacity-50 transition"
                                    >
                                        <Check className="w-3.5 h-3.5" /> Approve
                                    </button>
                                    <button
                                        onClick={() => decide(row.id, "reject")}
                                        disabled={busyId === row.id}
                                        className="inline-flex items-center gap-1.5 rounded-lg bg-red-500/15 text-red-400 ring-1 ring-inset ring-red-500/30 px-3 py-1.5 text-xs font-semibold hover:bg-red-500/25 disabled:opacity-50 transition"
                                    >
                                        <X className="w-3.5 h-3.5" /> Reject
                                    </button>
                                </div>
                            </div>

                            {expanded === row.id && (
                                <pre className="mt-3 rounded-xl bg-black/40 border border-white/10 p-4 text-xs text-gray-300 overflow-x-auto">
                                    {JSON.stringify(row.payload, null, 2)}
                                </pre>
                            )}
                        </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
}

export default function ApprovalsPage() {
    const ready = useRequireRole(["lead", "admin"]);
    const [tab, setTab] = useState<"members" | "content">("members");

    if (!ready) return null;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                    <ClipboardCheck className="w-7 h-7 text-red" />
                    Review &amp; Approvals
                </h1>
                <p className="mt-2 text-gray-400 text-sm max-w-xl">
                    New member signups, role changes, and member-proposed content — all in one place.
                </p>
            </div>

            <div className="flex gap-2">
                <button
                    onClick={() => setTab("members")}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                        tab === "members" ? "bg-red/15 text-white ring-1 ring-inset ring-red/40" : "text-gray-400 hover:bg-white/5"
                    }`}
                >
                    <UserCheck className="w-4 h-4" /> Members
                </button>
                <button
                    onClick={() => setTab("content")}
                    className={`inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                        tab === "content" ? "bg-red/15 text-white ring-1 ring-inset ring-red/40" : "text-gray-400 hover:bg-white/5"
                    }`}
                >
                    <ClipboardCheck className="w-4 h-4" /> Content
                </button>
            </div>

            {tab === "members" ? <MembersTab /> : <ContentTab />}
        </div>
    );
}
