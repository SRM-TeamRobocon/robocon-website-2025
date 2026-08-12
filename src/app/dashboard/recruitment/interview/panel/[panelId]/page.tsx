"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useRequireRole } from "@/hooks/use-require-role";

type TokenStatus = "waiting" | "called" | "done" | "no_show";

// The queue endpoint branches its payload by role: lead/admin receive the full interviewer
// profile, role "member" receives only { token_id, token_number, status, recruit.first_name }.
// This display only ever needs the reduced shape, and `first_name` ("Arjun S.") is computed
// server-side for BOTH payloads, so the page renders identically whichever role is casting it.
interface QueueToken {
    token_id: string;
    token_number: number;
    status: TokenStatus;
    recruit: { first_name?: string };
}

interface Panel {
    id: string;
    domain_label: string;
}

// Live TV/projector display for a single panel's queue. This unavoidably renders inside
// the AdminLayout dashboard shell (sidebar/topbar) because it lives under src/app/dashboard/
// and /dashboard/* is globally gated by admin_token in src/proxy.ts. Per 07-INTERVIEW-MODULE.md
// this is an accepted fallback ("OR you can gate it behind admin_token if preferred") — gated
// broad (member/lead/admin) since the content (token numbers + first names) isn't sensitive.
// Updates via 3s polling of the panel's queue endpoint (no Supabase Realtime — see route notes).
export default function InterviewQueueDisplayPage() {
    const { panelId } = useParams<{ panelId: string }>();
    const ready = useRequireRole(["member", "lead", "admin"]);
    const [panel, setPanel] = useState<Panel | null>(null);
    const [queue, setQueue] = useState<QueueToken[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const fetchQueue = useCallback(async () => {
        try {
            const res = await fetch(`/api/admin/recruitment/panels/${panelId}/queue`);
            const data = await res.json();
            if (res.ok) {
                setQueue(data.data ?? []);
                setError(null);
            } else {
                setError(data.error || "Could not load queue");
            }
        } catch {
            setError("Could not load queue");
        } finally {
            setLoading(false);
        }
    }, [panelId]);

    const fetchPanel = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/recruitment/panels");
            const data = await res.json();
            if (res.ok) {
                const match = (data.data ?? []).find((p: Panel) => p.id === panelId);
                if (match) setPanel(match);
            }
        } catch {
            // Non-fatal — the display still works without the panel name.
        }
    }, [panelId]);

    useEffect(() => {
        if (!ready) return;
        fetchPanel();
        fetchQueue();
        const interval = setInterval(fetchQueue, 3000);
        return () => clearInterval(interval);
    }, [ready, fetchPanel, fetchQueue]);

    if (!ready) return null;

    const called = queue.find((t) => t.status === "called") ?? null;
    const nextUp = queue.filter((t) => t.status === "waiting").slice(0, 5);

    return (
        <div className="flex min-h-[70vh] flex-col items-center justify-center rounded-3xl border border-white/10 bg-black/40 px-6 py-16 text-center">
            <p className="text-lg font-bold uppercase tracking-[0.3em] text-red">
                {panel?.domain_label ?? "Interview"} Panel
            </p>

            {loading ? (
                <p className="mt-10 text-2xl text-gray-500">Loading...</p>
            ) : error ? (
                <p className="mt-10 text-2xl text-red-400">{error}</p>
            ) : (
                <>
                    <p className="mt-12 text-2xl font-semibold uppercase tracking-widest text-gray-400">
                        Now Serving
                    </p>
                    {called ? (
                        <p className="mt-4 break-words text-6xl font-black text-white sm:text-8xl">
                            #{called.token_number}
                            {called.recruit?.first_name ? ` — ${called.recruit.first_name}` : ""}
                        </p>
                    ) : (
                        <p className="mt-4 text-4xl font-bold text-gray-500 sm:text-5xl">
                            Waiting for next call...
                        </p>
                    )}

                    <div className="mt-16 w-full max-w-3xl">
                        <p className="text-lg font-semibold uppercase tracking-widest text-gray-400">Next Up</p>
                        {nextUp.length === 0 ? (
                            <p className="mt-4 text-2xl text-gray-600">Queue is empty</p>
                        ) : (
                            <div className="mt-4 flex flex-wrap justify-center gap-4">
                                {nextUp.map((t) => (
                                    <span
                                        key={t.token_id}
                                        className="rounded-2xl border border-white/10 bg-white/5 px-6 py-3 text-3xl font-bold text-white sm:text-4xl"
                                    >
                                        #{t.token_number}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
