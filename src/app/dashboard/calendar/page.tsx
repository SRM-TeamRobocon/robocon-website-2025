"use client";

import { useRequireRole } from "@/hooks/use-require-role";
import CalendarWidget from "@/components/calendar/CalendarWidget";

export default function CalendarPage() {
    const ready = useRequireRole(["member", "lead", "admin"]);
    if (!ready) return null;

    return <CalendarWidget />;
}
