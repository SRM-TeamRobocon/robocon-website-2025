"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, CalendarClock, Pencil } from "lucide-react";
import { useRequireRole } from "@/hooks/use-require-role";
import TimetableGrid from "@/components/timetable/TimetableGrid";
import { emptySchedule, type TimetableSchedule } from "@/lib/timetable";

interface TimetableDetail {
    owner_username: string;
    owner_name: string;
    domain: string | null;
    schedule: TimetableSchedule;
    campus: string;
    updated_at: string;
}

interface LeaveToday {
    start_time: string | null;
    end_time: string | null;
    member_accounts: { email: string } | null;
}

export default function ViewTimetablePage() {
    const rawParams = useParams<{ username: string }>();
    // Next.js hasn't decoded this segment yet at this point, so decode it ourselves
    // before re-encoding for the API call — otherwise "@" (encoded as %40 in the
    // link) gets encoded a second time into "%2540", and the lookup 404s forever.
    const username = decodeURIComponent(rawParams.username);
    const ready = useRequireRole(["member", "lead", "admin"]);
    const [detail, setDetail] = useState<TimetableDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [isOwn, setIsOwn] = useState(false);
    const [todayDayOrder, setTodayDayOrder] = useState<string | null>(null);
    const [leaveToday, setLeaveToday] = useState<{ startTime: string | null; endTime: string | null } | null>(null);

    useEffect(() => {
        if (!ready) return;

        fetch(`/api/dashboard/timetables/${encodeURIComponent(username)}`)
            .then((res) => res.json())
            .then((data) => {
                if (data.success) {
                    setDetail(data.data);
                } else {
                    setNotFound(true);
                }
            })
            .catch(() => setNotFound(true))
            .finally(() => setLoading(false));

        fetch("/api/dashboard/day-order")
            .then((res) => res.json())
            .then((data) => {
                if (data.success && data.todayEntry) setTodayDayOrder(data.todayEntry.day_order);
            })
            .catch(() => {});

        fetch("/api/dashboard/leave-requests/today")
            .then((res) => res.json())
            .then((data) => {
                if (!data.success) return;
                const match = (data.data as LeaveToday[]).find((row) => row.member_accounts?.email === username);
                if (match) setLeaveToday({ startTime: match.start_time, endTime: match.end_time });
            })
            .catch(() => {});

        // Best-effort only — used to decide whether to show the "Edit" button. A
        // failure here shouldn't affect whether the fetched timetable is shown.
        fetch("/api/admin/me")
            .then((res) => res.json())
            .then((data) => {
                if (data.success && data.user === username) setIsOwn(true);
            })
            .catch(() => {});
    }, [ready, username]);

    if (!ready) return null;

    return (
        <div className="space-y-6">
            <Link
                href="/dashboard/timetable"
                className="inline-flex items-center gap-1.5 text-sm text-gray-400 transition hover:text-white"
            >
                <ArrowLeft className="h-4 w-4" /> Back to Timetable
            </Link>

            {loading ? (
                <div className="p-8 text-center text-sm text-gray-500">Loading...</div>
            ) : notFound || !detail ? (
                <div className="border border-white/10 bg-black p-10 text-center">
                    <CalendarClock className="mx-auto mb-3 h-8 w-8 text-gray-700" />
                    <p className="text-sm text-gray-400">This member hasn&apos;t saved a timetable yet.</p>
                </div>
            ) : (
                <>
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                            <h1 className="flex items-center gap-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
                                <CalendarClock className="h-6 w-6 shrink-0 text-red sm:h-7 sm:w-7" />
                                {detail.owner_name}
                            </h1>
                            <p className="mt-2 text-sm text-gray-400">
                                {detail.domain ? `${detail.domain} · ` : ""}
                                Updated {new Date(detail.updated_at).toLocaleString()}
                            </p>
                        </div>
                        {isOwn && (
                            <Link
                                href="/dashboard/timetable/me"
                                className="inline-flex w-fit shrink-0 items-center gap-1.5 bg-blue-500/15 px-4 py-2.5 text-sm font-semibold text-blue-400 ring-1 ring-inset ring-blue-500/30 transition hover:bg-blue-500/25"
                            >
                                <Pencil className="h-4 w-4" /> Edit
                            </Link>
                        )}
                    </div>

                    <TimetableGrid
                        schedule={detail.schedule || emptySchedule()}
                        campus={detail.campus}
                        todayDayOrder={todayDayOrder}
                        leaveToday={leaveToday}
                    />
                </>
            )}
        </div>
    );
}
