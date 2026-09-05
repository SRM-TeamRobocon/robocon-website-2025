"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";
import { RECRUIT_SUBSYSTEMS } from "@/lib/recruit-domains";

type NowServing = { token_number: number; first_name: string; called_at: string | null };
type WaitingToken = { token_number: number; first_name: string };

type TableCard = {
    id: string;
    domain_label: string;
    table_number: number | null;
    now_serving: NowServing | null;
};

type DomainGroup = {
    sub_domain: string;
    domain_label: string;
    subsystem: string;
    tables: TableCard[];
    waiting: WaitingToken[];
};

// A "called" name flickers for this long before settling into the static solid-red look -
// long enough to catch a glance from across the room, short enough not to keep blinking
// once the recruit has surely noticed and is walking over.
const FLICKER_MS = 10_000;

// Per-domain cap on rendered waiting chips - a hard ceiling (not a fit calculation) so the
// page never needs to scroll no matter how long a line gets; anything past it collapses
// into a single "+N more" chip instead of growing the card.
const MAX_WAITING_CHIPS = 10;

// Bright, light kiosk screen - no login (see the carve-out for /api/recruit/tables in
// src/proxy.ts), deliberately NOT the dark glass look the rest of the recruit site uses:
// this is meant to be read at a glance across a room, on a TV or a recruit's own phone.
// One column per subsystem, one card per open table, everything sized with flexbox to fit
// the viewport with zero scrolling - no RecruitBackdrop/GlassCard here, both assume a dark
// backdrop underneath.
export default function RecruitTablesPage() {
    const [domains, setDomains] = useState<DomainGroup[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    // Drives the "called" flicker only - separate from the 4s data poll so a name blinks
    // smoothly between refetches instead of jumping once every 4s.
    const [now, setNow] = useState(() => Date.now());

    const load = useCallback(async () => {
        try {
            const res = await fetch("/api/recruit/tables", { cache: "no-store" });
            const json = await res.json();
            if (res.ok) {
                setDomains(json.domains ?? []);
                setError(null);
            } else {
                setError(json.error || "Could not load tables");
            }
        } catch {
            setError("Could not load tables");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        load();
        const interval = setInterval(load, 4000);
        return () => clearInterval(interval);
    }, [load]);

    useEffect(() => {
        const tick = setInterval(() => setNow(Date.now()), 250);
        return () => clearInterval(tick);
    }, []);

    // Grouped by subsystem (RECRUIT_SUBSYSTEMS order); each domain group already comes back
    // in domain order from the API. A domain only appears at all if it has an open table or
    // someone waiting - a fully idle domain is dropped rather than shown empty.
    const columns = useMemo(() => {
        const groups = new Map<string, DomainGroup[]>(RECRUIT_SUBSYSTEMS.map((s) => [s, []]));
        for (const d of domains) {
            groups.get(d.subsystem)?.push(d);
        }
        return RECRUIT_SUBSYSTEMS.map((subsystem) => ({ subsystem, groups: groups.get(subsystem) ?? [] }));
    }, [domains]);

    return (
        // Zero-scroll is a hard requirement from `sm:` up (tablet/desktop/TV - the actual
        // kiosk case). Below that, a phone genuinely can't fit 4 columns × several tables ×
        // full queues without either scrolling or unreadably shrinking text, so mobile falls
        // back to a normal scrolling page instead of clipping content mid-word.
        //
        // Sharp/angular styling throughout (square corners, thick black borders, mono
        // labels) instead of the soft rounded-glass look elsewhere on the recruit site -
        // meant to read like a HUD/status board, not a marketing page.
        <div className="min-h-dvh sm:h-dvh w-screen sm:overflow-hidden bg-white flex flex-col">
            <header className="shrink-0 text-center py-4 px-4 border-b-4 border-gray-900 bg-white">
                <p className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-red">Interview Day</p>
                <h1 className="text-3xl md:text-4xl font-black tracking-tight text-gray-900 flex items-center justify-center gap-2.5">
                    <Users className="h-7 w-7 md:h-8 md:w-8 text-red" /> Table Status
                </h1>
            </header>

            {loading ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-10 h-10 border-4 border-gray-200 border-t-red rounded-full animate-spin" />
                </div>
            ) : error ? (
                <p className="flex-1 flex items-center justify-center text-lg text-red font-bold">{error}</p>
            ) : domains.length === 0 ? (
                <p className="flex-1 flex items-center justify-center text-lg text-gray-400 font-bold">
                    No tables are open right now - check back shortly.
                </p>
            ) : (
                <div className="flex-1 sm:min-h-0 grid grid-cols-2 lg:grid-cols-4 gap-3 p-3 sm:overflow-hidden">
                    {columns.map(({ subsystem, groups }) => (
                        <div key={subsystem} className="flex flex-col sm:min-h-0 gap-2.5 sm:overflow-hidden">
                            <h2 className="shrink-0 bg-gray-900 py-2 text-center font-mono text-sm font-black uppercase tracking-[0.2em] text-white">
                                {subsystem}
                            </h2>
                            {groups.length === 0 ? (
                                <p className="text-center text-sm font-bold text-gray-400 py-4">No open tables</p>
                            ) : (
                                <div className="flex-1 sm:min-h-0 flex flex-col gap-2.5 sm:overflow-hidden">
                                    {groups.map((d) => (
                                        <DomainGroupCard key={d.sub_domain} domain={d} now={now} />
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function DomainGroupCard({ domain, now }: { domain: DomainGroup; now: number }) {
    return (
        <div className="flex-1 sm:min-h-0 basis-0 flex flex-col gap-1.5 sm:overflow-hidden">
            <p className="shrink-0 font-mono text-xs font-bold uppercase tracking-[0.15em] text-gray-500">{domain.domain_label}</p>

            {domain.tables.length === 0 ? (
                <p className="shrink-0 border-2 border-dashed border-gray-300 text-center text-sm font-bold text-gray-400 py-2.5">
                    No table open yet
                </p>
            ) : (
                <div className="flex flex-col gap-1.5">
                    {domain.tables.map((t) => (
                        <TableCard key={t.id} table={t} now={now} />
                    ))}
                </div>
            )}

            {domain.waiting.length > 0 && <WaitingStrip waiting={domain.waiting} />}
        </div>
    );
}

function TableCard({ table, now }: { table: TableCard; now: number }) {
    const called = table.now_serving;
    const isFlickering = Boolean(called?.called_at) && now - new Date(called!.called_at as string).getTime() < FLICKER_MS;

    return (
        <div className="border-2 border-gray-900 bg-white px-2.5 py-2 flex items-center justify-between gap-2">
            {/* Always the DB-stored domain_label, never a synthesized short name - it's the
                one guaranteed-unique identifier, so two "Corporate" tables never look identical. */}
            <p className="truncate font-mono text-xs font-bold uppercase tracking-wide text-gray-500">{table.domain_label}</p>

            {called ? (
                <span
                    className={
                        "inline-flex shrink-0 items-center gap-1.5 px-3 py-1.5 font-mono text-sm font-bold " +
                        (isFlickering ? "recruit-table-called-flicker" : "bg-red text-white")
                    }
                >
                    #{called.token_number} {called.first_name}
                </span>
            ) : (
                <span className="shrink-0 text-sm font-bold text-gray-300">Nobody being served</span>
            )}
        </div>
    );
}

function WaitingStrip({ waiting }: { waiting: WaitingToken[] }) {
    const shown = waiting.slice(0, MAX_WAITING_CHIPS);
    const overflow = waiting.length - shown.length;

    return (
        <div className="flex-1 sm:min-h-0 basis-0 border-2 border-gray-900 bg-white p-2 flex flex-col sm:overflow-hidden">
            <p className="shrink-0 font-mono text-[0.65rem] font-bold uppercase tracking-[0.2em] text-gray-500 pb-1">
                Waiting ({waiting.length})
            </p>
            <div className="flex-1 sm:min-h-0 sm:overflow-hidden flex flex-wrap content-start gap-1.5">
                {/* Waiting = red border, called = red fill (see TableCard). Two states, nothing else. */}
                {shown.map((w) => (
                    <span
                        key={w.token_number}
                        className="inline-flex items-center gap-1.5 border-2 border-red px-2.5 py-1 font-mono text-xs font-bold text-gray-900"
                    >
                        #{w.token_number} {w.first_name}
                    </span>
                ))}
                {overflow > 0 && (
                    <span className="inline-flex items-center border-2 border-gray-300 px-2.5 py-1 font-mono text-xs font-bold text-gray-500">
                        +{overflow} more
                    </span>
                )}
            </div>
        </div>
    );
}
