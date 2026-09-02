"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { CalendarClock, Pencil } from "lucide-react";
import { DAYS } from "@/lib/timetable";

interface DayOrderEntry {
    date: string;
    day_order: string;
    source: "academia_sync" | "manual";
    synced_at: string;
}

interface DayOrderBannerProps {
    // Only lead/admin get the manual-override control - the Academia sync bot will
    // fail sometimes, and without this the whole day-order feature goes dark until
    // someone fixes the scraper.
    canOverride: boolean;
}

export default function DayOrderBanner({ canOverride }: DayOrderBannerProps) {
    const [entry, setEntry] = useState<DayOrderEntry | null>(null);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState(false);
    const [picked, setPicked] = useState<(typeof DAYS)[number]>(DAYS[0]);
    const [saving, setSaving] = useState(false);

    const load = () => {
        fetch("/api/dashboard/day-order")
            .then((res) => res.json())
            .then((data) => {
                if (data.success) setEntry(data.todayEntry);
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    };

    useEffect(() => {
        load();
    }, []);

    const save = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/admin/day-order", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dayOrder: picked }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success("Today's Day Order updated");
                setEditing(false);
                load();
            } else {
                toast.error(data.error || "Could not save");
            }
        } finally {
            setSaving(false);
        }
    };

    if (loading) return null;

    return (
        <div className="flex flex-wrap items-center gap-3 border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm">
            <CalendarClock className="h-4 w-4 shrink-0 text-cyan-400" />
            {entry ? (
                <span className="text-gray-300">
                    Today is <span className="font-bold text-white">{entry.day_order}</span>
                    <span className="ml-1.5 text-xs text-gray-500">
                        ({entry.source === "manual" ? "set manually" : "synced from Academia"} at{" "}
                        {new Date(entry.synced_at).toLocaleTimeString()})
                    </span>
                </span>
            ) : (
                <span className="text-gray-500">Today's Day Order hasn't been set yet.</span>
            )}

            {canOverride &&
                (editing ? (
                    <span className="ml-auto flex items-center gap-2">
                        <select
                            value={picked}
                            onChange={(e) => setPicked(e.target.value as (typeof DAYS)[number])}
                            className="border border-white/10 bg-white/5 px-2 py-1 text-xs font-semibold text-white outline-none focus:border-cyan-500"
                        >
                            {DAYS.map((day) => (
                                <option key={day} value={day} className="bg-gray-900">
                                    {day}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={save}
                            disabled={saving}
                            className="bg-cyan-500/15 px-3 py-1 text-xs font-semibold text-cyan-300 ring-1 ring-inset ring-cyan-500/30 hover:bg-cyan-500/25 disabled:opacity-50 transition"
                        >
                            {saving ? "Saving..." : "Save"}
                        </button>
                        <button onClick={() => setEditing(false)} className="text-xs text-gray-500 hover:text-gray-300">
                            Cancel
                        </button>
                    </span>
                ) : (
                    <button
                        onClick={() => {
                            setPicked((entry?.day_order as (typeof DAYS)[number]) || DAYS[0]);
                            setEditing(true);
                        }}
                        className="ml-auto inline-flex items-center gap-1 text-xs font-semibold text-gray-400 hover:text-white"
                    >
                        <Pencil className="h-3 w-3" /> Override
                    </button>
                ))}
        </div>
    );
}
