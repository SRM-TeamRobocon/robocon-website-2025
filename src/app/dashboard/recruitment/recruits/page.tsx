"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import { Users, Search, Download, Check, X, Trash2, Pencil } from "lucide-react";
import { useRoleGate } from "@/hooks/use-require-role";
import { groupBySubsystem, subDomainLabel } from "@/lib/recruit-domains";
import { SortableTh, compareBy, nextSortState, type SortState } from "@/components/recruit/SortableTh";
import { HOSTEL_BLOCKS } from "@/lib/hostel-blocks";
import { TRAVEL_METHODS, travelMethodLabel } from "@/lib/travel-method";
import { GENDERS, genderLabel } from "@/lib/gender";
import { ExpandToggleCell, DetailRow, DetailField } from "@/components/recruit/ExpandableRow";
import Select from "@/components/ui/select";

const DOMAIN_GROUPS = groupBySubsystem();

type SortKey = "name" | "reg_no";

interface Recruit {
    id: string;
    name: string;
    reg_no: string;
    year: string;
    gender: string | null;
    department: string;
    course: string;
    srm_email: string;
    phone: string;
    is_hosteller: boolean;
    hostel_block: string | null;
    hostel_room: string | null;
    day_scholar_area: string | null;
    travel_method: string | null;
    domains: string[];
    orientation: boolean;
    // One row per exam actually sat. Exam attendance is keyed (recruit, cycle, sub_domain),
    // so a recruit who applied for two domains has at most one entry per domain.
    exams: { sub_domain: string; day: number }[];
}

function Flag({ ok }: { ok: boolean }) {
    return ok ? <Check className="w-4 h-4 text-emerald-400" /> : <X className="w-4 h-4 text-gray-600" />;
}

// Which exam a recruit sat is the useful fact, not which day they showed up on: a recruit
// with two domains sits two different exams, so a bare "Day 1 / Day 2" pair couldn't say
// WHICH one they turned up for. Pair every domain they applied for with whether they sat it.
function DomainAttendance({ domains, exams }: { domains: string[]; exams: Recruit["exams"] }) {
    if (domains.length === 0) return <span className="text-gray-600">—</span>;

    const dayOf = new Map((exams ?? []).map((e) => [e.sub_domain, e.day]));

    return (
        <div className="flex flex-wrap gap-1.5">
            {domains.map((d) => {
                const day = dayOf.get(d);
                const attended = day !== undefined;
                return (
                    <span
                        key={d}
                        title={attended ? `Sat the ${subDomainLabel(d)} exam on Day ${day}` : `Did not sit the ${subDomainLabel(d)} exam`}
                        className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium ring-1 ring-inset whitespace-nowrap ${
                            attended
                                ? "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30"
                                : "bg-white/[0.04] text-gray-500 ring-white/10"
                        }`}
                    >
                        {attended ? <Check className="w-3 h-3 shrink-0" /> : <X className="w-3 h-3 shrink-0" />}
                        {subDomainLabel(d)}
                    </span>
                );
            })}
        </div>
    );
}

export default function RecruitsPage() {
    const { ready, role } = useRoleGate(["member", "lead", "admin"]);
    // Every dashboard role can view and edit recruits; deleting stays lead/admin-only — a
    // delete cascades away their scans, marks and interview records. The API enforces
    // this; this just hides the button that would always 403 for a member.
    const canDeleteRecruits = role === "lead" || role === "admin";
    const [recruits, setRecruits] = useState<Recruit[]>([]);
    const [loading, setLoading] = useState(true);
    const [domain, setDomain] = useState("");
    const [year, setYear] = useState("");
    const [search, setSearch] = useState("");
    const [error, setError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [sort, setSort] = useState<SortState<SortKey>>(null);
    const [editingRecruit, setEditingRecruit] = useState<Recruit | null>(null);
    const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

    const onSort = (key: SortKey) => setSort((prev) => nextSortState(prev, key));

    const toggleExpanded = (id: string) =>
        setExpandedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });

    // Search/domain/year filtering already happened server-side, so `recruits` is the full
    // result set by the time it lands here — sorting it is just re-ordering what's loaded.
    const sortedRecruits = useMemo(() => {
        if (!sort) return recruits;
        return [...recruits].sort((a, b) => compareBy(a[sort.key], b[sort.key], sort.direction));
    }, [recruits, sort]);

    // Hard delete — cascades away the recruit's scans, marks, shortlist and interview rows.
    const deleteRecruit = async (r: Recruit) => {
        if (!confirm(`Permanently delete ${r.name} (${r.reg_no})?\n\nThis also removes their attendance scans, marks, shortlist status and interview records. This cannot be undone.`)) {
            return;
        }
        setDeletingId(r.id);
        try {
            const res = await fetch(`/api/admin/recruitment/recruits/${r.id}`, { method: "DELETE" });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(`Deleted ${r.name}`);
                setRecruits((prev) => prev.filter((x) => x.id !== r.id));
            } else {
                toast.error(data.error || "Could not delete recruit");
            }
        } catch {
            toast.error("Could not delete recruit");
        } finally {
            setDeletingId(null);
        }
    };

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
        }, 250); // debounce search/filter changes

        return () => {
            clearTimeout(t);
            controller.abort();
        };
    }, [ready, domain, year, search]);

    const exportHref = useMemo(() => {
        const params = new URLSearchParams();
        if (domain) params.set("domain", domain);
        if (year) params.set("year", year);
        if (search) params.set("search", search);
        const qs = params.toString();
        return `/api/admin/recruitment/recruits/export${qs ? `?${qs}` : ""}`;
    }, [domain, year, search]);

    if (!ready) return null;

    return (
        <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                        <Users className="w-7 h-7 text-red" />
                        Recruits
                    </h1>
                    <p className="mt-2 text-gray-400 text-sm max-w-xl">
                        All registrations for the active recruitment cycle. Each domain chip shows
                        whether that recruit sat <em>that domain&apos;s</em> exam — hover a chip for the day.
                    </p>
                </div>
                <a
                    href={exportHref}
                    className="inline-flex items-center gap-1.5 bg-white/10 px-4 py-2 text-sm font-semibold text-white hover:bg-white/20 transition self-start sm:self-auto"
                >
                    <Download className="w-4 h-4" /> Export CSV
                </a>
            </div>

            <div
                className="border border-white/10 bg-white/[0.03] backdrop-blur-xl p-4 flex flex-col sm:flex-row gap-3"
                style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
            >
                <div className="relative flex-1">
                    <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by name or reg no..."
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
                            { value: "3", label: "Year 3" },
                        ]}
                    />
                </div>
            </div>

            <div
                className="border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden"
                style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
            >
                {loading ? (
                    <div className="p-8 text-center text-gray-500 text-sm">Loading...</div>
                ) : error ? (
                    <div className="p-8 text-center text-gray-500 text-sm">{error}</div>
                ) : recruits.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 text-sm">No recruits match these filters.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="text-left text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-white/10">
                                    <SortableTh label="Name" sortKey="name" sort={sort} onSort={onSort} />
                                    <SortableTh label="Reg No" sortKey="reg_no" sort={sort} onSort={onSort} />
                                    <th className="px-5 py-3">Domain(s) &amp; Exam Attendance</th>
                                    <th className="px-5 py-3 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedRecruits.map((r) => {
                                    const expanded = expandedIds.has(r.id);
                                    return (
                                        <Fragment key={r.id}>
                                            <tr className="border-b border-white/5 last:border-0">
                                                <ExpandToggleCell expanded={expanded} onToggle={() => toggleExpanded(r.id)}>
                                                    {r.name}
                                                </ExpandToggleCell>
                                                <td className="px-5 py-3 text-gray-300">{r.reg_no}</td>
                                                <td className="px-5 py-3 text-gray-300">
                                                    <DomainAttendance domains={r.domains} exams={r.exams} />
                                                </td>
                                                <td className="px-5 py-3 text-right">
                                                    <div className="flex justify-end gap-2">
                                                        <button
                                                            onClick={() => setEditingRecruit(r)}
                                                            title={`Edit ${r.name}`}
                                                            className="inline-flex items-center gap-1.5 bg-white/10 px-2.5 py-1.5 text-xs font-semibold text-gray-300 ring-1 ring-inset ring-white/10 transition hover:bg-white/20 hover:text-white"
                                                        >
                                                            <Pencil className="w-3.5 h-3.5" />
                                                            Edit
                                                        </button>
                                                        {canDeleteRecruits && (
                                                            <button
                                                                onClick={() => deleteRecruit(r)}
                                                                disabled={deletingId === r.id}
                                                                title={`Delete ${r.name}`}
                                                                className="inline-flex items-center gap-1.5 bg-red-500/10 px-2.5 py-1.5 text-xs font-semibold text-red-400 ring-1 ring-inset ring-red-500/30 transition hover:bg-red-500/25 disabled:opacity-40"
                                                            >
                                                                <Trash2 className="w-3.5 h-3.5" />
                                                                {deletingId === r.id ? "Deleting..." : "Delete"}
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                            {expanded && (
                                                <DetailRow colSpan={4}>
                                                    <DetailField label="Year" value={r.year} />
                                                    <DetailField label="Gender" value={genderLabel(r.gender) || "—"} />
                                                    <DetailField label="Department" value={r.department} />
                                                    <DetailField
                                                        label="Stay"
                                                        value={
                                                            r.is_hosteller ? (
                                                                <>
                                                                    <span className="text-white">{r.hostel_block}</span>
                                                                    {r.hostel_room && (
                                                                        <span className="text-gray-500"> · {r.hostel_room}</span>
                                                                    )}
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <span className="text-gray-500">
                                                                        Day Scholar{r.day_scholar_area ? ` · ${r.day_scholar_area}` : ""}
                                                                    </span>
                                                                    {r.travel_method && (
                                                                        <span className="text-gray-500"> · {travelMethodLabel(r.travel_method)}</span>
                                                                    )}
                                                                </>
                                                            )
                                                        }
                                                    />
                                                    <DetailField label="Orientation" value={<Flag ok={r.orientation} />} />
                                                </DetailRow>
                                            )}
                                        </Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            {editingRecruit && (
                <EditRecruitModal
                    recruit={editingRecruit}
                    onClose={() => setEditingRecruit(null)}
                    onSaved={(updated) => {
                        setRecruits((prev) => prev.map((x) => (x.id === updated.id ? { ...x, ...updated } : x)));
                        setEditingRecruit(null);
                    }}
                />
            )}
        </div>
    );
}

// Fields PATCH /api/admin/recruitment/recruits/:id accepts and returns. Deliberately a
// subset of Recruit — srm_email/domains aren't editable here (see the route's own comment).
type EditableFields = Pick<
    Recruit,
    | "id"
    | "name"
    | "reg_no"
    | "year"
    | "gender"
    | "department"
    | "course"
    | "phone"
    | "is_hosteller"
    | "hostel_block"
    | "hostel_room"
    | "day_scholar_area"
    | "travel_method"
>;

function EditRecruitModal({
    recruit,
    onClose,
    onSaved,
}: {
    recruit: Recruit;
    onClose: () => void;
    onSaved: (updated: EditableFields) => void;
}) {
    const [name, setName] = useState(recruit.name);
    const [regNo, setRegNo] = useState(recruit.reg_no);
    const [year, setYear] = useState(recruit.year);
    const [gender, setGender] = useState(recruit.gender || "");
    const [department, setDepartment] = useState(recruit.department);
    const [course, setCourse] = useState(recruit.course || "");
    const [phone, setPhone] = useState(recruit.phone || "");
    const [isHosteller, setIsHosteller] = useState(recruit.is_hosteller);
    const [hostelBlock, setHostelBlock] = useState(recruit.hostel_block || "");
    const [hostelRoom, setHostelRoom] = useState(recruit.hostel_room || "");
    const [dayScholarArea, setDayScholarArea] = useState(recruit.day_scholar_area || "");
    const [travelMethod, setTravelMethod] = useState(recruit.travel_method || "");
    const [saving, setSaving] = useState(false);

    const save = async () => {
        setSaving(true);
        try {
            const res = await fetch(`/api/admin/recruitment/recruits/${recruit.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name,
                    reg_no: regNo,
                    year,
                    gender: gender || null,
                    department,
                    course,
                    phone,
                    is_hosteller: isHosteller,
                    // Mirrors the server's own rule: a non-hosteller is always sent as
                    // (false, null, null) rather than trusting stale block/room state left
                    // over from before the checkbox was toggled off — and the reverse for
                    // day_scholar_area/travel_method when toggled to hosteller.
                    hostel_block: isHosteller ? hostelBlock : null,
                    hostel_room: isHosteller ? hostelRoom : null,
                    day_scholar_area: isHosteller ? null : dayScholarArea,
                    travel_method: isHosteller ? null : travelMethod,
                }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success(`Saved ${data.data.name}`);
                onSaved(data.data);
            } else {
                toast.error(data.error || "Could not save recruit");
            }
        } catch {
            toast.error("Could not save recruit");
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
            <div
                className="w-full max-w-lg border border-white/10 bg-gray-950 p-6 max-h-[90vh] overflow-y-auto"
                style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
            >
                <h2 className="text-xl font-bold text-white mb-4">Edit Recruit</h2>

                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">Name</label>
                        <input
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full border-0 bg-white/5 py-2 px-3 text-white text-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-red"
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">Reg No</label>
                        <input
                            value={regNo}
                            onChange={(e) => setRegNo(e.target.value)}
                            className="w-full border-0 bg-white/5 py-2 px-3 text-white text-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-red"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">Year</label>
                            <Select
                                value={year}
                                onChange={setYear}
                                className="bg-white/5 ring-white/10 py-2 px-3 text-sm"
                                options={[
                                    { value: "1", label: "Year 1" },
                                    { value: "2", label: "Year 2" },
                                    { value: "3", label: "Year 3" },
                                ]}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">Phone</label>
                            <input
                                value={phone}
                                onChange={(e) => setPhone(e.target.value)}
                                maxLength={10}
                                placeholder="10-digit number"
                                className="w-full border-0 bg-white/5 py-2 px-3 text-white text-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-red"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">Gender</label>
                        <Select
                            value={gender}
                            onChange={setGender}
                            placeholder="Select"
                            className="bg-white/5 ring-white/10 py-2 px-3 text-sm"
                            options={GENDERS.map((g) => ({ value: g.key, label: g.label }))}
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">Department</label>
                            <input
                                value={department}
                                onChange={(e) => setDepartment(e.target.value)}
                                className="w-full border-0 bg-white/5 py-2 px-3 text-white text-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-red"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">Course</label>
                            <input
                                value={course}
                                onChange={(e) => setCourse(e.target.value)}
                                className="w-full border-0 bg-white/5 py-2 px-3 text-white text-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-red"
                            />
                        </div>
                    </div>

                    <label className="flex items-center gap-2 text-sm text-gray-300 pt-1">
                        <input
                            type="checkbox"
                            checked={isHosteller}
                            onChange={(e) => setIsHosteller(e.target.checked)}
                            className="border-white/20 bg-white/5 text-red focus:ring-red"
                        />
                        Hosteller
                    </label>

                    {isHosteller && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">Hostel Block</label>
                                <Select
                                    value={hostelBlock}
                                    onChange={setHostelBlock}
                                    placeholder="Select block"
                                    className="bg-white/5 ring-white/10 py-2 px-3 text-sm"
                                    options={HOSTEL_BLOCKS.map((b) => ({ value: b, label: b }))}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">Room</label>
                                <input
                                    value={hostelRoom}
                                    onChange={(e) => setHostelRoom(e.target.value)}
                                    className="w-full border-0 bg-white/5 py-2 px-3 text-white text-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-red"
                                />
                            </div>
                        </div>
                    )}

                    {!isHosteller && (
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">Area</label>
                                <input
                                    value={dayScholarArea}
                                    onChange={(e) => setDayScholarArea(e.target.value)}
                                    placeholder="e.g. Tambaram"
                                    className="w-full border-0 bg-white/5 py-2 px-3 text-white text-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-red"
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">Travel Method</label>
                                <Select
                                    value={travelMethod}
                                    onChange={setTravelMethod}
                                    placeholder="Select"
                                    className="bg-white/5 ring-white/10 py-2 px-3 text-sm"
                                    options={TRAVEL_METHODS.map((m) => ({ value: m.key, label: m.label }))}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div className="mt-6 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        disabled={saving}
                        className="px-4 py-2 text-sm font-semibold text-gray-400 hover:text-white transition disabled:opacity-40"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={save}
                        disabled={saving}
                        className="group relative overflow-hidden bg-red px-8 py-2 text-sm font-semibold text-white shadow-lg shadow-red/30 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-red/40 active:translate-y-0 active:scale-[0.97] disabled:opacity-40 disabled:pointer-events-none"
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
                            {saving ? "Saving..." : "Save Changes"}
                        </span>
                    </button>
                </div>
            </div>
        </div>
    );
}
