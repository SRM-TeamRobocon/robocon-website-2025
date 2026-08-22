"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { Ticket as TicketIcon, CheckCircle2 } from "lucide-react";
import { useRoleGate } from "@/hooks/use-require-role";
import { RECRUIT_SUBDOMAINS, subDomainFullLabel } from "@/lib/recruit-domains";
import Select from "@/components/ui/select";

type TicketRow = {
    id: string;
    category: "domain_change" | "general";
    message: string;
    current_sub_domains: string[] | null;
    from_sub_domain: string | null;
    requested_sub_domain: string | null;
    status: "open" | "resolved";
    resolution_note: string | null;
    resolved_by: string | null;
    resolved_at: string | null;
    created_at: string;
    recruit: { name: string; reg_no: string; srm_email: string };
};

function ResolveRow({ ticket, onResolved }: { ticket: TicketRow; onResolved: () => void }) {
    const [note, setNote] = useState("");
    const [busy, setBusy] = useState(false);
    const [open, setOpen] = useState(false);
    const isDomainChange = ticket.category === "domain_change" && !!ticket.from_sub_domain && !!ticket.requested_sub_domain;
    const [applyDomainChange, setApplyDomainChange] = useState(isDomainChange);
    const [targetDomain, setTargetDomain] = useState(ticket.requested_sub_domain ?? "");

    const resolve = async () => {
        setBusy(true);
        try {
            const res = await fetch(`/api/admin/recruitment/tickets/${ticket.id}/resolve`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    resolution_note: note.trim() || undefined,
                    ...(isDomainChange && applyDomainChange
                        ? { apply_domain_change: true, new_sub_domain: targetDomain }
                        : {}),
                }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(isDomainChange && applyDomainChange ? "Ticket resolved, domain switched" : "Ticket resolved");
                onResolved();
            } else {
                toast.error(data.error || "Could not resolve ticket");
            }
        } finally {
            setBusy(false);
        }
    };

    if (!open) {
        return (
            <button
                onClick={() => setOpen(true)}
                className="inline-flex items-center gap-1.5 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/30 transition hover:bg-emerald-500/25"
            >
                <CheckCircle2 className="h-3.5 w-3.5" /> Mark Resolved
            </button>
        );
    }

    return (
        <div className="flex flex-wrap items-center gap-2">
            {isDomainChange && (
                <label className="flex items-center gap-2 text-xs text-gray-300">
                    <input
                        type="checkbox"
                        checked={applyDomainChange}
                        onChange={(e) => setApplyDomainChange(e.target.checked)}
                        className="border-white/20 bg-white/5 text-emerald-500 focus:ring-emerald-500"
                    />
                    Switch domain to
                </label>
            )}
            {isDomainChange && applyDomainChange && (
                <div className="w-44">
                    <Select
                        value={targetDomain}
                        onChange={setTargetDomain}
                        className="h-8 bg-white/5 ring-white/10 py-0 px-2 text-xs"
                        options={RECRUIT_SUBDOMAINS.filter((d) => d.key !== ticket.from_sub_domain).map((d) => ({
                            value: d.key,
                            label: d.label,
                        }))}
                    />
                </div>
            )}
            <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Resolution note (optional)"
                className="flex-1 min-w-[160px] border-0 bg-white/5 py-1.5 px-3 text-sm text-white ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-emerald-500"
            />
            <button
                onClick={resolve}
                disabled={busy || (isDomainChange && applyDomainChange && !targetDomain)}
                className="inline-flex items-center gap-1.5 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/30 transition hover:bg-emerald-500/25 disabled:opacity-50"
            >
                Confirm
            </button>
            <button
                onClick={() => setOpen(false)}
                disabled={busy}
                className="inline-flex items-center gap-1.5 bg-white/5 px-3 py-1.5 text-xs font-semibold text-gray-400 ring-1 ring-inset ring-white/10 hover:bg-white/10"
            >
                Cancel
            </button>
        </div>
    );
}

export default function TicketsPage() {
    const { ready, role } = useRoleGate(["member", "lead", "admin"]);
    const canResolve = role === "lead" || role === "admin";
    const [tickets, setTickets] = useState<TicketRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [noCycle, setNoCycle] = useState(false);

    const load = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/recruitment/tickets");
            const data = await res.json();
            if (res.ok) {
                setNoCycle(false);
                setTickets(data.data ?? []);
            } else if (res.status === 503) {
                setNoCycle(true);
            } else {
                toast.error(data.error || "Could not load tickets");
            }
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!ready) return;
        load();
    }, [ready, load]);

    if (!ready) return null;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                    <TicketIcon className="w-7 h-7 text-red" />
                    Tickets
                </h1>
                <p className="mt-2 text-gray-400 text-sm max-w-xl">
                    Domain change requests and general questions raised by recruits from their dashboard.
                </p>
            </div>

            {noCycle ? (
                <div
                    className="border border-amber-500/30 bg-amber-500/[0.06] p-6 text-sm text-amber-300"
                    style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
                >
                    No active recruitment cycle.
                </div>
            ) : loading ? (
                <div className="p-8 text-center text-gray-500 text-sm">Loading...</div>
            ) : tickets.length === 0 ? (
                <div
                    className="border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-gray-500"
                    style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
                >
                    No tickets yet.
                </div>
            ) : (
                <div className="space-y-3">
                    {tickets.map((t) => (
                        <div
                            key={t.id}
                            className={`border p-4 ${
                                t.status === "open"
                                    ? "border-amber-500/30 bg-amber-500/[0.06]"
                                    : "border-white/10 bg-white/[0.03]"
                            } backdrop-blur-xl`}
                            style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
                        >
                            <div className="flex items-start justify-between gap-3 flex-wrap">
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-white">{t.recruit.name}</span>
                                        <span className="text-xs text-gray-500">{t.recruit.reg_no}</span>
                                        <span
                                            className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                                t.category === "domain_change"
                                                    ? "bg-blue-500/10 text-blue-400"
                                                    : "bg-white/10 text-gray-300"
                                            }`}
                                        >
                                            {t.category === "domain_change" ? "Domain Change" : "General"}
                                        </span>
                                        <span
                                            className={`px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${
                                                t.status === "open"
                                                    ? "bg-amber-500/15 text-amber-400"
                                                    : "bg-emerald-500/15 text-emerald-400"
                                            }`}
                                        >
                                            {t.status}
                                        </span>
                                    </div>
                                    {t.category === "domain_change" && (
                                        <p className="mt-1 text-xs text-gray-400">
                                            {t.from_sub_domain ? subDomainFullLabel(t.from_sub_domain) : "—"}
                                            {" → "}
                                            <span className="text-white font-semibold">
                                                {t.requested_sub_domain ? subDomainFullLabel(t.requested_sub_domain) : "—"}
                                            </span>
                                        </p>
                                    )}
                                    <p className="mt-1.5 text-sm text-gray-300 whitespace-pre-wrap">{t.message}</p>
                                    {t.resolution_note && (
                                        <p className="mt-1.5 text-sm text-emerald-300/80 border-l-2 border-emerald-500/30 pl-2">
                                            {t.resolution_note}
                                        </p>
                                    )}
                                </div>
                                <span className="text-xs text-gray-500 shrink-0">
                                    {new Date(t.created_at).toLocaleString()}
                                </span>
                            </div>

                            {t.status === "open" && canResolve && (
                                <div className="mt-3">
                                    <ResolveRow ticket={t} onResolved={load} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
