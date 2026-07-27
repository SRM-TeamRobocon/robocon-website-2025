"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import toast from "react-hot-toast";
import { ArrowLeft, CalendarClock, Save } from "lucide-react";
import { useRequireRole } from "@/hooks/use-require-role";
import TimetableGrid from "@/components/timetable/TimetableGrid";
import { emptySchedule, type TimetableSchedule } from "@/lib/timetable";

export default function MyTimetablePage() {
    const ready = useRequireRole(["member", "lead", "admin"]);
    const [schedule, setSchedule] = useState<TimetableSchedule>(emptySchedule());
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [updatedAt, setUpdatedAt] = useState<string | null>(null);

    useEffect(() => {
        if (!ready) return;
        fetch("/api/member/timetable")
            .then((res) => res.json())
            .then((data) => {
                if (data.success) {
                    setSchedule(data.schedule);
                    setUpdatedAt(data.updatedAt);
                }
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, [ready]);

    const handleChange = (day: string, slotIndex: number, value: string) => {
        setSchedule((prev) => {
            const next = { ...prev, [day]: [...(prev[day] || [])] };
            next[day][slotIndex] = value;
            return next;
        });
    };

    const save = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/member/timetable", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ schedule }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success("Timetable saved");
                setUpdatedAt(new Date().toISOString());
            } else {
                toast.error(data.error || "Could not save timetable");
            }
        } catch {
            toast.error("An unexpected error occurred");
        } finally {
            setSaving(false);
        }
    };

    if (!ready) return null;

    return (
        <div className="space-y-6">
            <Link
                href="/dashboard/timetable"
                className="inline-flex items-center gap-1.5 text-sm text-gray-400 transition hover:text-white"
            >
                <ArrowLeft className="h-4 w-4" /> Back to Timetable
            </Link>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h1 className="flex items-center gap-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
                        <CalendarClock className="h-6 w-6 shrink-0 text-red sm:h-7 sm:w-7" />
                        My Timetable
                    </h1>
                    <p className="mt-2 max-w-xl text-sm text-gray-400">
                        Set what each slot is for. Changes are visible to everyone in the dashboard as soon as you save.
                        {updatedAt && <> Last saved {new Date(updatedAt).toLocaleString()}.</>}
                    </p>
                </div>
                <button
                    onClick={save}
                    disabled={saving || loading}
                    className="inline-flex w-fit shrink-0 items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-blue-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:from-blue-500 hover:to-blue-400 disabled:opacity-50"
                >
                    <Save className="h-4 w-4" /> {saving ? "Saving..." : "Save"}
                </button>
            </div>

            {loading ? (
                <div className="p-8 text-center text-sm text-gray-500">Loading...</div>
            ) : (
                <TimetableGrid schedule={schedule} editable onChange={handleChange} />
            )}
        </div>
    );
}
