"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { CalendarOff } from "lucide-react";
import { useRequireRole } from "@/hooks/use-require-role";

interface LeaveRequest {
    id: string;
    start_date: string;
    end_date: string;
    start_time: string | null;
    end_time: string | null;
    reason: string;
    status: "pending" | "approved" | "rejected";
    review_note: string | null;
    created_at: string;
}

const STATUS_STYLES: Record<LeaveRequest["status"], string> = {
    pending: "bg-amber-500/15 text-amber-400 ring-amber-500/30",
    approved: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
    rejected: "bg-red-500/15 text-red-400 ring-red-500/30",
};

function todayISO(): string {
    return new Date().toISOString().slice(0, 10);
}

export default function LeaveRequestPage() {
    const ready = useRequireRole(["member", "lead", "admin"]);
    const [rows, setRows] = useState<LeaveRequest[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    const [startDate, setStartDate] = useState(todayISO());
    const [endDate, setEndDate] = useState(todayISO());
    const [fullDay, setFullDay] = useState(true);
    const [startTime, setStartTime] = useState("09:00");
    const [endTime, setEndTime] = useState("17:00");
    const [reason, setReason] = useState("");

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/member/leave-requests");
            const data = await res.json();
            if (data.success) setRows(data.data);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (ready) load();
    }, [ready]);

    const submit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!reason.trim()) {
            toast.error("Give a reason for the leave");
            return;
        }
        setSubmitting(true);
        try {
            const res = await fetch("/api/member/leave-requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    startDate,
                    endDate,
                    startTime: fullDay ? null : startTime,
                    endTime: fullDay ? null : endTime,
                    reason: reason.trim(),
                }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success("Leave request submitted");
                setReason("");
                load();
            } else {
                toast.error(data.error || "Could not submit request");
            }
        } finally {
            setSubmitting(false);
        }
    };

    if (!ready) return null;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                    <CalendarOff className="w-7 h-7 text-red" />
                    Request Leave
                </h1>
                <p className="mt-2 text-gray-400 text-sm max-w-xl">
                    Once a lead/admin approves it, it shows as "on leave" on the timetable and attendance board.
                </p>
            </div>

            <form
                onSubmit={submit}
                className="border border-white/10 bg-black backdrop-blur-xl p-5 space-y-4"
            >
                <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Start date</span>
                        <input
                            type="date"
                            required
                            value={startDate}
                            onChange={(e) => {
                                setStartDate(e.target.value);
                                if (e.target.value > endDate) setEndDate(e.target.value);
                            }}
                            className="mt-1.5 w-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-red"
                        />
                    </label>
                    <label className="block">
                        <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">End date</span>
                        <input
                            type="date"
                            required
                            min={startDate}
                            value={endDate}
                            onChange={(e) => setEndDate(e.target.value)}
                            className="mt-1.5 w-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-red"
                        />
                    </label>
                </div>

                <label className="flex items-center gap-2 text-sm text-gray-300">
                    <input type="checkbox" checked={fullDay} onChange={(e) => setFullDay(e.target.checked)} className="accent-red" />
                    Full day{startDate !== endDate ? "(s)" : ""}
                </label>

                {!fullDay && (
                    <div className="grid gap-4 sm:grid-cols-2">
                        <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">From</span>
                            <input
                                type="time"
                                required
                                value={startTime}
                                onChange={(e) => setStartTime(e.target.value)}
                                className="mt-1.5 w-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-red"
                            />
                        </label>
                        <label className="block">
                            <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">To</span>
                            <input
                                type="time"
                                required
                                value={endTime}
                                onChange={(e) => setEndTime(e.target.value)}
                                className="mt-1.5 w-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-red"
                            />
                        </label>
                    </div>
                )}

                <label className="block">
                    <span className="text-xs font-semibold uppercase tracking-wide text-gray-500">Reason</span>
                    <textarea
                        required
                        rows={3}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Why are you requesting leave?"
                        className="mt-1.5 w-full border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-red resize-none"
                    />
                </label>

                <button
                    type="submit"
                    disabled={submitting}
                    className="inline-flex items-center gap-1.5 bg-red/15 text-white ring-1 ring-inset ring-red/40 px-5 py-2.5 text-sm font-semibold hover:bg-red/25 disabled:opacity-50 transition"
                >
                    {submitting ? "Submitting..." : "Submit request"}
                </button>
            </form>

            <div className="border border-white/10 bg-black backdrop-blur-xl">
                {loading ? (
                    <div className="p-8 text-center text-gray-500 text-sm">Loading...</div>
                ) : rows.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 text-sm">No leave requests yet.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-white/10">
                                    <th className="px-5 py-3">Dates</th>
                                    <th className="px-5 py-3">Time</th>
                                    <th className="px-5 py-3">Reason</th>
                                    <th className="px-5 py-3">Status</th>
                                    <th className="px-5 py-3">Note</th>
                                </tr>
                            </thead>
                            <tbody>
                                {rows.map((row) => (
                                    <tr key={row.id} className="border-b border-white/5 last:border-0">
                                        <td className="px-5 py-3 text-white">
                                            {row.start_date === row.end_date
                                                ? new Date(row.start_date).toLocaleDateString()
                                                : `${new Date(row.start_date).toLocaleDateString()} – ${new Date(row.end_date).toLocaleDateString()}`}
                                        </td>
                                        <td className="px-5 py-3 text-gray-300">
                                            {row.start_time && row.end_time ? `${row.start_time}–${row.end_time}` : "Full day"}
                                        </td>
                                        <td className="px-5 py-3 text-gray-300 max-w-xs truncate" title={row.reason}>
                                            {row.reason}
                                        </td>
                                        <td className="px-5 py-3">
                                            <span
                                                className={`inline-flex items-center px-2.5 py-1 text-xs font-semibold ring-1 ring-inset capitalize ${STATUS_STYLES[row.status]}`}
                                            >
                                                {row.status}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-gray-400">{row.review_note || "-"}</td>
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
