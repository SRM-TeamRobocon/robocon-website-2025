"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Users } from "lucide-react";
import { RECRUIT_SUBDOMAINS, RECRUIT_SUBSYSTEMS, subDomainSubsystem } from "@/lib/recruit-domains";

type TableToken = { token_number: number; first_name: string };

type TableRow = {
    id: string;
    domain_label: string;
    sub_domain: string | null;
    table_number: number | null;
    now_serving: TableToken | null;
    waiting: TableToken[];
};

const DOMAIN_ORDER = new Map<string, number>(RECRUIT_SUBDOMAINS.map((d, i) => [d.key, i]));

// Per-table cap on rendered waiting chips — a hard ceiling (not a fit calculation) so the
// page never needs to scroll no matter how long a line gets; anything past it collapses
// into a single "+N more" chip instead of growing the card.
const MAX_WAITING_CHIPS = 10;

// Bright, light kiosk screen — no login (see the carve-out for /api/recruit/tables in
// src/proxy.ts), deliberately NOT the dark glass look the rest of the recruit site uses:
// this is meant to be read at a glance across a room, on a TV or a recruit's own phone.
// One column per subsystem, one card per open table, everything sized with flexbox to fit
// the viewport with zero scrolling — no RecruitBackdrop/GlassCard here, both assume a dark
// backdrop underneath.
export default function RecruitTablesPage() {
    const [tables, setTables] = useState<TableRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch("/api/recruit/tables", { cache: "no-store" });
            const json = await res.json();
            if (res.ok) {
                setTables(json.tables ?? []);
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

    // Grouped by subsystem (RECRUIT_SUBSYSTEMS order), each group's rows sorted by domain
    // then table number. Tables with no sub_domain (legacy, pre-migration panels) have no
    // subsystem to sit under and are dropped from this view.
    const columns = useMemo(() => {
        const groups = new Map<string, TableRow[]>(RECRUIT_SUBSYSTEMS.map((s) => [s, []]));
        for (const t of tables) {
            if (!t.sub_domain) continue;
            groups.get(subDomainSubsystem(t.sub_domain))?.push(t);
        }
        for (const rows of Array.from(groups.values())) {
            rows.sort((a: TableRow, b: TableRow) => {
                const domainDiff = (DOMAIN_ORDER.get(a.sub_domain ?? "") ?? 0) - (DOMAIN_ORDER.get(b.sub_domain ?? "") ?? 0);
                if (domainDiff !== 0) return domainDiff;
                return (a.table_number ?? 0) - (b.table_number ?? 0);
            });
        }
        return RECRUIT_SUBSYSTEMS.map((subsystem) => ({ subsystem, rows: groups.get(subsystem) ?? [] }));
    }, [tables]);

    return (
        // Zero-scroll is a hard requirement from `sm:` up (tablet/desktop/TV — the actual
        // kiosk case). Below that, a phone genuinely can't fit 4 columns × several tables ×
        // full queues without either scrolling or unreadably shrinking text, so mobile falls
        // back to a normal scrolling page instead of clipping content mid-word.
        //
        // Sharp/angular styling throughout (square corners, thick black borders, mono
        // labels) instead of the soft rounded-glass look elsewhere on the recruit site —
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
            ) : tables.length === 0 ? (
                <p className="flex-1 flex items-center justify-center text-lg text-gray-400 font-bold">
                    No tables are open right now — check back shortly.
                </p>
            ) : (
                <div className="flex-1 sm:min-h-0 grid grid-cols-2 lg:grid-cols-4 gap-3 p-3 sm:overflow-hidden">
                    {columns.map(({ subsystem, rows }) => (
                        <div key={subsystem} className="flex flex-col sm:min-h-0 gap-2.5 sm:overflow-hidden">
                            <h2 className="shrink-0 bg-gray-900 py-2 text-center font-mono text-sm font-black uppercase tracking-[0.2em] text-white">
                                {subsystem}
                            </h2>
                            {rows.length === 0 ? (
                                <p className="text-center text-sm font-bold text-gray-400 py-4">No open tables</p>
                            ) : (
                                <div className="flex-1 sm:min-h-0 flex flex-col gap-2.5 sm:overflow-hidden">
                                    {rows.map((t) => (
                                        <TableCard key={t.id} table={t} />
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

function TableCard({ table }: { table: TableRow }) {
    const shown = table.waiting.slice(0, MAX_WAITING_CHIPS);
    const overflow = table.waiting.length - shown.length;
    const isEmpty = !table.now_serving && shown.length === 0;

    return (
        <div className="flex-1 sm:min-h-0 basis-0 border-2 border-gray-900 bg-white p-2.5 flex flex-col sm:overflow-hidden">
            {/* Always the DB-stored domain_label, never a synthesized short name — it's the
                one guaranteed-unique identifier, so two "Corporate" tables never look identical. */}
            <p className="shrink-0 truncate text-base font-black uppercase tracking-wide text-gray-900 border-b-2 border-gray-900 pb-1.5 mb-1.5">
                {table.domain_label}
            </p>

            <div className="flex-1 sm:min-h-0 sm:overflow-hidden flex flex-wrap content-start gap-2">
                {isEmpty && <span className="text-sm font-bold text-gray-300">Queue empty</span>}

                {/* Called = red background. Waiting = red border. Two states, nothing else. */}
                {table.now_serving && (
                    <span className="inline-flex items-center gap-1.5 bg-red px-3 py-1.5 font-mono text-sm font-bold text-white">
                        #{table.now_serving.token_number} {table.now_serving.first_name}
                    </span>
                )}
                {shown.map((w) => (
                    <span
                        key={w.token_number}
                        className="inline-flex items-center gap-1.5 border-2 border-red px-3 py-1.5 font-mono text-sm font-bold text-gray-900"
                    >
                        #{w.token_number} {w.first_name}
                    </span>
                ))}
                {overflow > 0 && (
                    <span className="inline-flex items-center border-2 border-gray-300 px-3 py-1.5 font-mono text-sm font-bold text-gray-500">
                        +{overflow} more
                    </span>
                )}
            </div>
        </div>
    );
}
