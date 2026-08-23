"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { AlertTriangle, CalendarRange, Plus, Power, PowerOff, Users } from "lucide-react";
import { useRequireRole } from "@/hooks/use-require-role";

interface Cycle {
    id: string;
    name: string;
    year: string;
    is_active: boolean;
    created_at: string;
    closed_at: string | null;
    total_recruits: number;
}

// A destructive action that needs the cycle's name typed out before it will run.
// Only used when real recruit data is at stake — a cycle with zero recruits just runs.
interface PendingAction {
    title: string;
    warning: string;
    confirmName: string;
    actionLabel: string;
    run: () => Promise<void>;
}

// A `border` doesn't render along a clip-path's angled edge, so the border is faked with
// a `::before` pseudo-element instead: same clip-path, inset -1px so its color peeks out
// uniformly around the real box, including along the diagonal cut corner.
const CARD_CLIP = "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)";

export default function RecruitmentCyclesPage() {
    const ready = useRequireRole(["lead", "admin"]);
    const [role, setRole] = useState<string | null>(null);
    const [cycles, setCycles] = useState<Cycle[]>([]);
    const [loading, setLoading] = useState(true);
    const [name, setName] = useState("");
    const [year, setYear] = useState("");
    const [creating, setCreating] = useState(false);
    const [closingId, setClosingId] = useState<string | null>(null);
    const [activatingId, setActivatingId] = useState<string | null>(null);

    const [pending, setPending] = useState<PendingAction | null>(null);
    const [confirmText, setConfirmText] = useState("");
    const [running, setRunning] = useState(false);

    useEffect(() => {
        fetch("/api/admin/me")
            .then((r) => r.json())
            .then((d) => {
                if (d.success) setRole(d.role);
            })
            .catch(() => {});
    }, []);

    const load = async () => {
        setLoading(true);
        try {
            const res = await fetch("/api/admin/recruitment/cycles");
            const data = await res.json();
            if (data.success) setCycles(data.data);
            else toast.error(data.error || "Could not load cycles");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (ready) load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready]);

    const isAdmin = role === "admin";
    const activeCycle = useMemo(() => cycles.find((c) => c.is_active) || null, [cycles]);

    const askConfirm = (action: PendingAction) => {
        setConfirmText("");
        setPending(action);
    };

    const runPending = async () => {
        if (!pending) return;
        setRunning(true);
        try {
            await pending.run();
            setPending(null);
            setConfirmText("");
        } finally {
            setRunning(false);
        }
    };

    const doCreate = async () => {
        setCreating(true);
        try {
            const res = await fetch("/api/admin/recruitment/cycles", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name: name.trim(), year: year.trim() }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                if (data.warning) toast(data.warning, { icon: "⚠️", duration: 8000 });
                else toast.success("Cycle created and activated");
                setName("");
                setYear("");
                load();
            } else {
                toast.error(data.error || "Could not create cycle");
            }
        } catch {
            toast.error("Could not create cycle");
        } finally {
            setCreating(false);
        }
    };

    const createCycle = (e: React.FormEvent) => {
        e.preventDefault();
        if (!name.trim() || !year.trim()) {
            toast.error("Name and year are required");
            return;
        }
        // Creating a cycle hands the whole module over to it. If the cycle being displaced
        // already has recruits, make that impossible to do by accident.
        if (activeCycle && activeCycle.total_recruits > 0) {
            askConfirm({
                title: "Replace the active cycle?",
                warning: `“${activeCycle.name}” is currently active and has ${activeCycle.total_recruits} recruit${
                    activeCycle.total_recruits === 1 ? "" : "s"
                }. Creating “${name.trim()}” will stand it down — its recruits keep their data, but they will no longer be able to sign in, scan, or see results until it is re-activated.`,
                confirmName: activeCycle.name,
                actionLabel: "Create & Activate",
                run: doCreate,
            });
            return;
        }
        void doCreate();
    };

    const doClose = async (id: string) => {
        setClosingId(id);
        try {
            const res = await fetch(`/api/admin/recruitment/cycles/${id}/close`, { method: "PATCH" });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success("Cycle closed — the recruitment module is now offline for students");
                load();
            } else {
                toast.error(data.error || "Could not close cycle");
            }
        } catch {
            toast.error("Could not close cycle");
        } finally {
            setClosingId(null);
        }
    };

    const closeCycle = (cycle: Cycle) => {
        const warning =
            "Closing the active cycle takes the entire recruitment module OFFLINE for students — signup, the recruit dashboard, every QR scanner, marks entry and interview queues all stop working until some cycle is active again. Nothing is deleted, and you can re-activate this cycle at any time.";
        if (cycle.total_recruits > 0) {
            askConfirm({
                title: "Close this cycle?",
                warning: `${warning}\n\n“${cycle.name}” has ${cycle.total_recruits} recruit${
                    cycle.total_recruits === 1 ? "" : "s"
                }.`,
                confirmName: cycle.name,
                actionLabel: "Close Cycle",
                run: () => doClose(cycle.id),
            });
            return;
        }
        if (!confirm(`Close “${cycle.name}”?\n\n${warning}`)) return;
        void doClose(cycle.id);
    };

    const activateCycle = async (cycle: Cycle) => {
        const displaced =
            activeCycle && activeCycle.id !== cycle.id
                ? `\n\n“${activeCycle.name}” is active right now and will be stood down.`
                : "";
        if (!confirm(`Make “${cycle.name}” the active cycle?${displaced}`)) return;

        setActivatingId(cycle.id);
        try {
            const res = await fetch(`/api/admin/recruitment/cycles/${cycle.id}/activate`, { method: "PATCH" });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(`“${cycle.name}” is now the active cycle`);
                load();
            } else {
                toast.error(data.error || "Could not activate cycle");
            }
        } catch {
            toast.error("Could not activate cycle");
        } finally {
            setActivatingId(null);
        }
    };

    if (!ready) return null;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                    <CalendarRange className="w-7 h-7 text-red" />
                    Recruitment Cycles
                </h1>
                <p className="mt-2 text-gray-400 text-sm max-w-xl">
                    Manage recruitment seasons. Only one cycle is active at a time — all student-facing pages and
                    admin tools scope to it automatically.
                </p>
            </div>

            {isAdmin && !activeCycle && !loading && cycles.length > 0 && (
                <div
                    className="relative isolate bg-amber-500/[0.07] backdrop-blur-xl p-4 flex items-start gap-3 before:content-[''] before:absolute before:-inset-px before:-z-10 before:[clip-path:var(--clip)] before:bg-amber-500/30"
                    style={{ clipPath: CARD_CLIP, "--clip": CARD_CLIP } as any}
                >
                    <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <p className="text-sm text-amber-200/90">
                        <span className="font-bold">No cycle is active.</span> The recruitment module is offline for
                        students — signup, scanners and the recruit dashboard will all error until you activate a
                        cycle below or create a new one.
                    </p>
                </div>
            )}

            {isAdmin && (
                <form
                    onSubmit={createCycle}
                    className="relative isolate bg-white/[0.03] backdrop-blur-xl p-5 flex flex-col sm:flex-row gap-3 sm:items-end before:content-[''] before:absolute before:-inset-px before:-z-10 before:[clip-path:var(--clip)] before:bg-white/10"
                    style={{ clipPath: CARD_CLIP, "--clip": CARD_CLIP } as any}
                >
                    <div className="flex-1">
                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                            Name
                        </label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Robocon 2026"
                            className="w-full border-0 bg-white/5 py-2 px-3 text-white text-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-red placeholder:text-gray-600"
                        />
                    </div>
                    <div className="flex-1">
                        <label className="block text-xs font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                            Year
                        </label>
                        <input
                            value={year}
                            onChange={(e) => setYear(e.target.value)}
                            placeholder="2025-26"
                            className="w-full border-0 bg-white/5 py-2 px-3 text-white text-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-red placeholder:text-gray-600"
                        />
                    </div>
                    <button
                        type="submit"
                        disabled={creating}
                        className="group relative overflow-hidden inline-flex items-center justify-center bg-red text-white px-8 py-2 text-sm font-semibold shadow-lg shadow-red/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-red/40 active:translate-y-0 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none"
                        style={{ clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)" }}
                    >
                        <span
                            className="absolute inset-0 -translate-x-full transition-transform duration-200 ease-out group-hover:translate-x-0"
                            style={{
                                clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)",
                                backgroundColor: "#D4AF37",
                            }}
                        />
                        <span className="relative inline-flex items-center gap-1.5 transition-colors duration-200 group-hover:text-black">
                            <Plus className="w-4 h-4" /> {creating ? "Creating..." : "Create Cycle"}
                        </span>
                    </button>
                </form>
            )}

            <div
                className="relative isolate bg-white/[0.03] backdrop-blur-xl before:content-[''] before:absolute before:-inset-px before:-z-10 before:[clip-path:var(--clip)] before:bg-white/10"
                style={{ clipPath: CARD_CLIP, "--clip": CARD_CLIP } as any}
            >
                {loading ? (
                    <div className="p-8 text-center text-gray-500 text-sm">Loading...</div>
                ) : cycles.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 text-sm">No recruitment cycles yet.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-white/10">
                                    <th className="px-5 py-3">Name</th>
                                    <th className="px-5 py-3">Year</th>
                                    <th className="px-5 py-3">Status</th>
                                    <th className="px-5 py-3">Recruits</th>
                                    <th className="px-5 py-3">Created</th>
                                    <th className="px-5 py-3">Closed</th>
                                    {isAdmin && <th className="px-5 py-3 text-right">Actions</th>}
                                </tr>
                            </thead>
                            <tbody>
                                {cycles.map((c) => (
                                    <tr key={c.id} className="border-b border-white/5 last:border-0">
                                        <td className="px-5 py-3 text-white font-medium">{c.name}</td>
                                        <td className="px-5 py-3 text-gray-300">{c.year}</td>
                                        <td className="px-5 py-3">
                                            {c.is_active ? (
                                                <span className="inline-flex items-center gap-1.5 bg-emerald-500/15 text-emerald-400 ring-1 ring-inset ring-emerald-500/30 px-2.5 py-1 text-xs font-semibold">
                                                    Active
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1.5 bg-white/5 text-gray-400 ring-1 ring-inset ring-white/10 px-2.5 py-1 text-xs font-semibold">
                                                    {c.closed_at ? "Closed" : "Inactive"}
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-5 py-3 text-gray-300">
                                            <span className="inline-flex items-center gap-1.5">
                                                <Users className="w-3.5 h-3.5 text-gray-500" /> {c.total_recruits}
                                            </span>
                                        </td>
                                        <td className="px-5 py-3 text-gray-400">
                                            {new Date(c.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-5 py-3 text-gray-400">
                                            {c.closed_at ? new Date(c.closed_at).toLocaleDateString() : "—"}
                                        </td>
                                        {isAdmin && (
                                            <td className="px-5 py-3 text-right">
                                                {c.is_active ? (
                                                    <button
                                                        onClick={() => closeCycle(c)}
                                                        disabled={closingId === c.id}
                                                        className="inline-flex items-center gap-1.5 bg-red-500/15 text-red-400 ring-1 ring-inset ring-red-500/30 px-3 py-1.5 text-xs font-semibold hover:bg-red-500/25 disabled:opacity-50 transition"
                                                    >
                                                        <PowerOff className="w-3.5 h-3.5" />{" "}
                                                        {closingId === c.id ? "Closing..." : "Close"}
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => activateCycle(c)}
                                                        disabled={activatingId === c.id}
                                                        className="inline-flex items-center gap-1.5 bg-emerald-500/15 text-emerald-400 ring-1 ring-inset ring-emerald-500/30 px-3 py-1.5 text-xs font-semibold hover:bg-emerald-500/25 disabled:opacity-50 transition"
                                                    >
                                                        <Power className="w-3.5 h-3.5" />{" "}
                                                        {activatingId === c.id ? "Activating..." : "Activate"}
                                                    </button>
                                                )}
                                            </td>
                                        )}
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {pending && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
                    <div
                        className="relative isolate w-full max-w-md bg-white/[0.03] backdrop-blur-xl p-6 shadow-2xl before:content-[''] before:absolute before:-inset-px before:-z-10 before:[clip-path:var(--clip)] before:bg-white/10"
                        style={{ clipPath: CARD_CLIP, "--clip": CARD_CLIP } as any}
                    >
                        <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                            <AlertTriangle className="h-5 w-5 text-red" />
                            {pending.title}
                        </h2>
                        <p className="mt-3 whitespace-pre-line text-sm leading-relaxed text-gray-300">
                            {pending.warning}
                        </p>
                        <label className="mt-5 block text-xs font-bold uppercase tracking-widest text-gray-500">
                            Type <span className="text-white">{pending.confirmName}</span> to confirm
                        </label>
                        <input
                            autoFocus
                            value={confirmText}
                            onChange={(e) => setConfirmText(e.target.value)}
                            placeholder={pending.confirmName}
                            className="mt-2 w-full border-0 bg-white/5 py-2 px-3 text-white text-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-red placeholder:text-gray-600"
                        />
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                type="button"
                                onClick={() => {
                                    setPending(null);
                                    setConfirmText("");
                                }}
                                disabled={running}
                                className="bg-white/5 px-4 py-2 text-sm font-semibold text-gray-300 ring-1 ring-inset ring-white/10 transition hover:bg-white/10 disabled:opacity-50"
                            >
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={runPending}
                                disabled={running || confirmText.trim() !== pending.confirmName}
                                className="group relative overflow-hidden bg-red text-white px-8 py-2 text-sm font-semibold transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-red/40 active:translate-y-0 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:pointer-events-none"
                                style={{ clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)" }}
                            >
                                <span
                                    className="absolute inset-0 -translate-x-full transition-transform duration-200 ease-out group-hover:translate-x-0"
                                    style={{
                                        clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)",
                                        backgroundColor: "#D4AF37",
                                    }}
                                />
                                <span className="relative transition-colors duration-200 group-hover:text-black">
                                    {running ? "Working..." : pending.actionLabel}
                                </span>
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
