"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Select from "@/components/ui/select";
import { RECRUIT_SUBDOMAINS, groupBySubsystem, subDomainFullLabel } from "@/lib/recruit-domains";

type TicketCategory = "domain_change" | "general";

type Ticket = {
    id: string;
    category: TicketCategory;
    message: string;
    from_sub_domain: string | null;
    requested_sub_domain: string | null;
    status: "open" | "resolved";
    resolution_note: string | null;
    resolved_at: string | null;
    created_at: string;
};

// Sharp red/white/black poster theme — matches the rest of the reskinned dashboard
// (see src/app/recruit/dashboard/page.tsx). Only used on that page, so no dark-glass
// remnants need to survive here.
const CARD_CLIP = "polygon(0 0,100% 0,100% 97%,97% 100%,0 100%)";

export default function TicketsSection({ currentDomains }: { currentDomains: string[] }) {
    const router = useRouter();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [category, setCategory] = useState<TicketCategory>("general");
    const [fromSubDomain, setFromSubDomain] = useState("");
    const [requestedSubDomain, setRequestedSubDomain] = useState("");
    const [message, setMessage] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const load = async () => {
        try {
            const res = await fetch("/api/recruit/tickets");
            if (res.status === 401) {
                router.push("/recruit/login");
                return;
            }
            const json = await res.json();
            if (res.ok && json.success) setTickets(json.data ?? []);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load();
    }, []);

    const openTicket = tickets.find((t) => t.status === "open") ?? null;
    const history = tickets.filter((t) => t.status !== "open" || t.id !== openTicket?.id);

    const canRequestDomainChange = currentDomains.length > 0;

    const fromOptions = RECRUIT_SUBDOMAINS.filter((d) => currentDomains.includes(d.key));
    // "To" excludes every domain the recruit already holds, not just the selected "from"
    // one — switching to a domain they're already registered in is never valid.
    const toOptions = RECRUIT_SUBDOMAINS.filter((d) => !currentDomains.includes(d.key));
    const toGroups = groupBySubsystem(toOptions).map((g) => ({
        label: g.subsystem,
        options: g.domains.map((d) => ({ value: d.key, label: d.label })),
    }));

    const selectCategory = (next: TicketCategory) => {
        setCategory(next);
        setError(null);
        if (next === "domain_change") {
            // Auto-pick when there's only one domain to switch out of — nothing to choose.
            setFromSubDomain(fromOptions.length === 1 ? fromOptions[0].key : "");
        } else {
            setFromSubDomain("");
            setRequestedSubDomain("");
        }
    };

    const submit = async () => {
        setError(null);
        if (!message.trim()) {
            setError("Please describe your request.");
            return;
        }
        if (category === "domain_change" && !fromSubDomain) {
            setError("Select which domain you're switching from.");
            return;
        }
        if (category === "domain_change" && !requestedSubDomain) {
            setError("Select which domain you'd like to switch to.");
            return;
        }

        setBusy(true);
        try {
            const res = await fetch("/api/recruit/tickets", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    category,
                    message: message.trim(),
                    ...(category === "domain_change"
                        ? { from_sub_domain: fromSubDomain, requested_sub_domain: requestedSubDomain }
                        : {}),
                }),
            });
            if (res.status === 401) {
                // Session expired between page load and submit — the raw "Unauthorized
                // access" from proxy.ts is a dead end for the recruit, so send them to log
                // back in rather than leaving them stuck on an error they can't act on.
                router.push("/recruit/login");
                return;
            }
            const json = await res.json();
            if (res.ok && json.success) {
                setMessage("");
                setFromSubDomain("");
                setRequestedSubDomain("");
                setCategory("general");
                await load();
            } else {
                setError(json.error || "Could not submit your ticket.");
            }
        } catch {
            setError("Network error while submitting your ticket.");
        } finally {
            setBusy(false);
        }
    };

    if (loading) return null;

    return (
        <div className="border-2 border-black bg-white p-6 md:p-8" style={{ clipPath: CARD_CLIP }}>
            <p className="font-mono text-xs uppercase tracking-widest text-black/40 mb-4">// raise a ticket</p>

            {openTicket ? (
                <div className="border border-amber-600 bg-amber-50 px-4 py-3 space-y-1.5">
                    <div className="flex items-center justify-between gap-3">
                        <span className="font-mono text-xs font-bold uppercase tracking-widest text-amber-700">
                            {openTicket.category === "domain_change" ? "Domain Change" : "General"} — Pending Review
                        </span>
                        <span className="text-xs text-black/40">
                            {new Date(openTicket.created_at).toLocaleDateString()}
                        </span>
                    </div>
                    {openTicket.category === "domain_change" && openTicket.from_sub_domain && openTicket.requested_sub_domain && (
                        <p className="text-sm text-black/70">
                            {subDomainFullLabel(openTicket.from_sub_domain)} → {subDomainFullLabel(openTicket.requested_sub_domain)}
                        </p>
                    )}
                    <p className="text-sm text-black/60 whitespace-pre-wrap">{openTicket.message}</p>
                    <p className="text-xs text-black/40">A lead will review this and get back to you.</p>
                </div>
            ) : (
                <div className="space-y-3">
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={() => selectCategory("general")}
                            className={`flex-1 border px-3 py-2 text-xs font-bold uppercase tracking-widest transition ${
                                category === "general"
                                    ? "border-red bg-red/10 text-red"
                                    : "border-black/15 bg-white text-black/50 hover:border-black/30"
                            }`}
                        >
                            General
                        </button>
                        <button
                            type="button"
                            onClick={() => canRequestDomainChange && selectCategory("domain_change")}
                            disabled={!canRequestDomainChange}
                            title={canRequestDomainChange ? undefined : "You have no domains registered yet"}
                            className={`flex-1 border px-3 py-2 text-xs font-bold uppercase tracking-widest transition ${
                                category === "domain_change"
                                    ? "border-red bg-red/10 text-red"
                                    : "border-black/15 bg-white text-black/50 hover:border-black/30"
                            } disabled:opacity-40 disabled:cursor-not-allowed`}
                        >
                            Domain Change
                        </button>
                    </div>

                    {category === "domain_change" && (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-black/40">From</p>
                                <Select
                                    accent="sharp"
                                    value={fromSubDomain}
                                    onChange={setFromSubDomain}
                                    placeholder="Switching from which domain?"
                                    options={fromOptions.map((d) => ({ value: d.key, label: d.label }))}
                                />
                            </div>
                            <div>
                                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-black/40">To</p>
                                <Select
                                    accent="sharp"
                                    value={requestedSubDomain}
                                    onChange={setRequestedSubDomain}
                                    placeholder="Switching to which domain?"
                                    groups={toGroups}
                                    options={toOptions.map((d) => ({ value: d.key, label: d.label }))}
                                />
                            </div>
                        </div>
                    )}

                    <textarea
                        value={message}
                        onChange={(e) => setMessage(e.target.value)}
                        placeholder={
                            category === "domain_change"
                                ? "Why would you like to switch domains?"
                                : "What do you need help with?"
                        }
                        rows={3}
                        className="w-full border-2 border-black/15 bg-white py-2 px-3 text-sm text-black placeholder:text-black/30 outline-none focus:border-red focus:ring-2 focus:ring-red/20 transition-all"
                    />

                    {error && <p className="text-xs text-red font-bold">{error}</p>}

                    <button
                        type="button"
                        onClick={submit}
                        disabled={busy}
                        className="border-2 border-red bg-red/10 px-4 py-2 text-xs font-bold uppercase tracking-widest text-red transition hover:bg-red hover:text-white disabled:opacity-50"
                    >
                        {busy ? "Submitting..." : "Submit Ticket"}
                    </button>
                </div>
            )}

            {history.length > 0 && (
                <div className="mt-6 pt-6 border-t border-black/10 space-y-2">
                    <p className="text-xs font-bold uppercase tracking-widest text-black/30 mb-2">Past Tickets</p>
                    {history.map((t) => (
                        <div key={t.id} className="border border-black/15 px-4 py-3 bg-black/[0.02]">
                            <div className="flex items-center justify-between gap-3">
                                <span className="text-xs font-bold uppercase tracking-widest text-black/50">
                                    {t.category === "domain_change" ? "Domain Change" : "General"}
                                </span>
                                <span className="text-xs font-bold uppercase tracking-widest text-emerald-700">
                                    Resolved
                                </span>
                            </div>
                            {t.category === "domain_change" && t.from_sub_domain && t.requested_sub_domain && (
                                <p className="mt-1 text-xs text-black/60">
                                    {subDomainFullLabel(t.from_sub_domain)} → {subDomainFullLabel(t.requested_sub_domain)}
                                </p>
                            )}
                            <p className="mt-1 text-sm text-black/50 whitespace-pre-wrap">{t.message}</p>
                            {t.resolution_note && (
                                <p className="mt-1.5 text-sm text-black/70 border-l-2 border-black/20 pl-2">
                                    {t.resolution_note}
                                </p>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
