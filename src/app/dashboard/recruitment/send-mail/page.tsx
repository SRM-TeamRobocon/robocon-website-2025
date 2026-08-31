"use client";

import { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Mail, Search, Send, CheckSquare, Square, AlertTriangle } from "lucide-react";
import { useRoleGate } from "@/hooks/use-require-role";
import { groupBySubsystem, subDomainLabel } from "@/lib/recruit-domains";
import Select from "@/components/ui/select";

const DOMAIN_GROUPS = groupBySubsystem();

interface Recruit {
    id: string;
    name: string;
    reg_no: string;
    year: string;
    srm_email: string;
    domains: string[];
}

interface SendResult {
    sent: number;
    failed: number;
    failures: { recruit_id: string; name: string; error: string }[];
}

interface ShortlistRow {
    sub_domain: string;
    status: "pending" | "shortlisted" | "not_shortlisted";
}

const STATUS_OPTIONS = [
    { value: "", label: "Any shortlist status" },
    { value: "shortlisted", label: "Shortlisted" },
    { value: "pending", label: "Pending" },
    { value: "not_shortlisted", label: "Not shortlisted" },
];

const STATUS_BADGE_STYLES: Record<string, string> = {
    shortlisted: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    pending: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    not_shortlisted: "bg-red-500/10 text-red-400 ring-red-500/30",
};

const STATUS_LABELS: Record<string, string> = {
    shortlisted: "Shortlisted",
    pending: "Pending",
    not_shortlisted: "Not shortlisted",
};

// Shortlist status is per (recruit, domain) — a recruit with two domains can be
// shortlisted in one and pending in the other, so this renders one badge per applied
// domain rather than a single recruit-level flag.
function ShortlistBadges({ domains, rows }: { domains: string[]; rows: ShortlistRow[] }) {
    if (domains.length === 0) return <span className="text-gray-600">—</span>;
    const statusOf = new Map(rows.map((r) => [r.sub_domain, r.status]));
    return (
        <div className="flex flex-wrap gap-1.5">
            {domains.map((d) => {
                const status = statusOf.get(d);
                return (
                    <span
                        key={d}
                        title={`${subDomainLabel(d)}: ${status ? STATUS_LABELS[status] : "Not computed yet"}`}
                        className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap ${
                            status ? STATUS_BADGE_STYLES[status] : "bg-white/[0.04] text-gray-500 ring-white/10"
                        }`}
                    >
                        {subDomainLabel(d)}
                    </span>
                );
            })}
        </div>
    );
}

export default function SendMailPage() {
    const { ready } = useRoleGate(["lead", "admin"]);
    const [recruits, setRecruits] = useState<Recruit[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [domain, setDomain] = useState("");
    const [year, setYear] = useState("");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [shortlistMap, setShortlistMap] = useState<Map<string, ShortlistRow[]>>(new Map());
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

    const [subject, setSubject] = useState("");
    const [messageBody, setMessageBody] = useState("");
    const [eventAt, setEventAt] = useState("");
    const [sending, setSending] = useState(false);
    const [result, setResult] = useState<SendResult | null>(null);

    useEffect(() => {
        if (!ready) return;

        const controller = new AbortController();
        const t = setTimeout(() => {
            setLoading(true);
            setError(null);
            const params = new URLSearchParams();
            if (domain) params.set("domain", domain);
            if (year) params.set("year", year);
            if (search) params.set("search", search);

            fetch(`/api/admin/recruitment/recruits?${params.toString()}`, { signal: controller.signal })
                .then((res) => res.json())
                .then((data) => {
                    if (data.success) setRecruits(data.data);
                    else setError(data.error || "Could not load recruits");
                })
                .catch((err) => {
                    if (err.name !== "AbortError") setError("Could not load recruits");
                })
                .finally(() => setLoading(false));
        }, 250);

        return () => {
            clearTimeout(t);
            controller.abort();
        };
    }, [ready, domain, year, search]);

    // Shortlist status lives in a separate table (recruit_shortlist_status), keyed per
    // recruit+domain — fetched alongside the roster so both the "Shortlist" column and the
    // status filter below can show it without a second round trip per row.
    useEffect(() => {
        if (!ready) return;

        const controller = new AbortController();
        const params = new URLSearchParams();
        if (domain) params.set("domain", domain);

        fetch(`/api/admin/recruitment/shortlist?${params.toString()}`, { signal: controller.signal })
            .then((res) => res.json())
            .then((data) => {
                if (!data.success) return;
                const map = new Map<string, ShortlistRow[]>();
                (data.data || []).forEach((row: { recruit_id: string; sub_domain: string; status: ShortlistRow["status"] }) => {
                    const list = map.get(row.recruit_id) || [];
                    list.push({ sub_domain: row.sub_domain, status: row.status });
                    map.set(row.recruit_id, list);
                });
                setShortlistMap(map);
            })
            .catch((err) => {
                if (err.name !== "AbortError") console.error("shortlist fetch failed", err);
            });

        return () => controller.abort();
    }, [ready, domain]);

    // Status filter is applied client-side against the already-loaded roster, since it's
    // a small extra join rather than another server-side filter param.
    const filteredRecruits = useMemo(() => {
        if (!statusFilter) return recruits;
        return recruits.filter((r) => (shortlistMap.get(r.id) || []).some((row) => row.status === statusFilter));
    }, [recruits, shortlistMap, statusFilter]);

    // A filter change can hide rows that were selected under a previous filter — drop
    // selections that are no longer in the visible/loaded set so "select all" stays honest.
    useEffect(() => {
        const visibleIds = new Set(filteredRecruits.map((r) => r.id));
        setSelectedIds((prev) => new Set(Array.from(prev).filter((id) => visibleIds.has(id))));
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [filteredRecruits]);

    const allSelected = filteredRecruits.length > 0 && filteredRecruits.every((r) => selectedIds.has(r.id));

    const toggleAll = () => {
        if (allSelected) setSelectedIds(new Set());
        else setSelectedIds(new Set(filteredRecruits.map((r) => r.id)));
    };

    const toggleOne = (id: string) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    };

    const canSend = selectedIds.size > 0 && subject.trim().length > 0 && messageBody.trim().length > 0 && !sending;

    const send = async () => {
        if (!canSend) return;
        if (
            !confirm(
                `Send this email to ${selectedIds.size} recruit${selectedIds.size === 1 ? "" : "s"}? This cannot be undone.`
            )
        ) {
            return;
        }

        setSending(true);
        setResult(null);
        try {
            const res = await fetch("/api/admin/recruitment/send-mail", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    recruit_ids: Array.from(selectedIds),
                    subject: subject.trim(),
                    body: messageBody.trim(),
                    event_at: eventAt ? new Date(eventAt).toISOString() : null,
                }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setResult({ sent: data.sent, failed: data.failed, failures: data.failures || [] });
                if (data.failed === 0) {
                    toast.success(`Sent to ${data.sent} recruit${data.sent === 1 ? "" : "s"}`);
                } else {
                    toast(`Sent to ${data.sent}, ${data.failed} failed`, { icon: "⚠️" });
                }
            } else {
                toast.error(data.error || "Could not send mail");
            }
        } catch {
            toast.error("Could not send mail");
        } finally {
            setSending(false);
        }
    };

    const selectedCount = selectedIds.size;

    if (!ready) return null;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                    <Mail className="w-7 h-7 text-red" />
                    Send Mail
                </h1>
                <p className="mt-2 text-gray-400 text-sm max-w-xl">
                    Compose an email and send it to selected recruits in the active cycle. Add a date &amp; time if the
                    email is about a specific slot (e.g. an interview or deadline); it&apos;s included in the email.
                </p>
            </div>

            <div className="border border-white/10 bg-black p-5 space-y-4">
                <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">Subject</label>
                    <input
                        value={subject}
                        onChange={(e) => setSubject(e.target.value)}
                        maxLength={200}
                        placeholder="e.g. Your interview slot"
                        className="w-full border-0 bg-white/5 py-2.5 px-3 text-white text-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-red placeholder:text-gray-600"
                    />
                </div>
                <div>
                    <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">Message</label>
                    <textarea
                        value={messageBody}
                        onChange={(e) => setMessageBody(e.target.value)}
                        maxLength={5000}
                        rows={6}
                        placeholder="Write the email body..."
                        className="w-full border-0 bg-white/5 py-2.5 px-3 text-white text-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-red placeholder:text-gray-600 resize-y"
                    />
                </div>
                <div className="max-w-xs">
                    <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">
                        Date &amp; Time <span className="text-gray-600 normal-case font-normal">(optional)</span>
                    </label>
                    <input
                        type="datetime-local"
                        value={eventAt}
                        onChange={(e) => setEventAt(e.target.value)}
                        className="w-full border-0 bg-white/5 py-2.5 px-3 text-white text-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-red [color-scheme:dark]"
                    />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <p className="text-sm text-gray-400">
                        <span className="text-white font-bold">{selectedCount}</span> recruit{selectedCount === 1 ? "" : "s"} selected
                    </p>
                    <button
                        onClick={send}
                        disabled={!canSend}
                        className="group relative overflow-hidden inline-flex items-center bg-red px-8 py-2.5 text-sm font-semibold text-white shadow-lg shadow-red/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-red/40 active:translate-y-0 active:scale-[0.97] disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none"
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
                            <Send className="w-4 h-4" />
                            {sending ? "Sending..." : "Send Mail"}
                        </span>
                    </button>
                </div>

                {result && (
                    <div className="bg-white/5 ring-1 ring-inset ring-white/10 p-3 text-sm">
                        <p className="text-gray-300">
                            Sent <span className="text-emerald-400 font-bold">{result.sent}</span>
                            {result.failed > 0 && (
                                <>
                                    {" "}
                                    · Failed <span className="text-red-400 font-bold">{result.failed}</span>
                                </>
                            )}
                        </p>
                        {result.failures.length > 0 && (
                            <ul className="mt-2 space-y-1 text-xs text-gray-500">
                                {result.failures.map((f) => (
                                    <li key={f.recruit_id} className="flex items-center gap-1.5">
                                        <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0" />
                                        {f.name}: {f.error}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
            </div>

            <div className="border border-white/10 bg-black p-4 flex flex-col sm:flex-row gap-3">
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name, reg no or phone..."
                        className="h-10 w-full border-0 bg-white/5 pl-9 pr-3 text-white text-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-red placeholder:text-gray-600"
                    />
                </div>
                <div className="w-48">
                    <Select
                        value={domain}
                        onChange={setDomain}
                        className="h-10 bg-white/5 ring-white/10 py-0 px-3 text-sm"
                        options={[
                            { value: "", label: "All domains" },
                            ...DOMAIN_GROUPS.flatMap((group) => group.domains.map((d) => ({ value: d.key, label: d.label }))),
                        ]}
                        leadingOptions={[{ value: "", label: "All domains" }]}
                        groups={DOMAIN_GROUPS.map((group) => ({
                            label: group.subsystem,
                            options: group.domains.map((d) => ({ value: d.key, label: d.label })),
                        }))}
                    />
                </div>
                <div className="w-36">
                    <Select
                        value={year}
                        onChange={setYear}
                        className="h-10 bg-white/5 ring-white/10 py-0 px-3 text-sm"
                        options={[
                            { value: "", label: "All years" },
                            { value: "1", label: "Year 1" },
                            { value: "2", label: "Year 2" },
                        ]}
                    />
                </div>
                <div className="w-52">
                    <Select
                        value={statusFilter}
                        onChange={setStatusFilter}
                        className="h-10 bg-white/5 ring-white/10 py-0 px-3 text-sm"
                        options={STATUS_OPTIONS}
                    />
                </div>
            </div>
            {!domain && (
                <p className="-mt-3 text-xs text-gray-500">
                    Filtering by shortlist status without a domain matches a recruit if{" "}
                    <span className="text-gray-400">any</span> of their applied domains have that status. Pick a
                    domain above to filter by that domain&apos;s status specifically.
                </p>
            )}

            <div className="border border-white/10 bg-black">
                {loading ? (
                    <div className="p-8 text-center text-gray-500 text-sm">Loading...</div>
                ) : error ? (
                    <div className="p-8 text-center text-gray-500 text-sm">{error}</div>
                ) : filteredRecruits.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 text-sm">No recruits match these filters.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-white/10">
                                    <th className="px-5 py-3 w-10">
                                        <button onClick={toggleAll} title={allSelected ? "Deselect all" : "Select all"} className="flex items-center">
                                            {allSelected ? (
                                                <CheckSquare className="w-4 h-4 text-red" />
                                            ) : (
                                                <Square className="w-4 h-4 text-gray-500" />
                                            )}
                                        </button>
                                    </th>
                                    <th className="px-5 py-3">Name</th>
                                    <th className="px-5 py-3">Reg No</th>
                                    <th className="px-5 py-3">Email</th>
                                    <th className="px-5 py-3">Shortlist</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredRecruits.map((r) => {
                                    const checked = selectedIds.has(r.id);
                                    return (
                                        <tr
                                            key={r.id}
                                            onClick={() => toggleOne(r.id)}
                                            className="border-b border-white/5 last:border-0 cursor-pointer hover:bg-white/[0.03]"
                                        >
                                            <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                                                <button onClick={() => toggleOne(r.id)} className="flex items-center">
                                                    {checked ? (
                                                        <CheckSquare className="w-4 h-4 text-red" />
                                                    ) : (
                                                        <Square className="w-4 h-4 text-gray-500" />
                                                    )}
                                                </button>
                                            </td>
                                            <td className="px-5 py-3 text-white font-medium">{r.name}</td>
                                            <td className="px-5 py-3 text-gray-300">{r.reg_no}</td>
                                            <td className="px-5 py-3 text-gray-400">{r.srm_email}</td>
                                            <td className="px-5 py-3">
                                                <ShortlistBadges domains={r.domains} rows={shortlistMap.get(r.id) || []} />
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
