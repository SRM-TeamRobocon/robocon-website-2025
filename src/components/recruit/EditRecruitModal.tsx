"use client";

import { useState } from "react";
import toast from "react-hot-toast";
import { groupBySubsystem } from "@/lib/recruit-domains";
import { HOSTEL_BLOCKS } from "@/lib/hostel-blocks";
import { TRAVEL_METHODS } from "@/lib/travel-method";
import { GENDERS } from "@/lib/gender";
import Select from "@/components/ui/select";

const DOMAIN_GROUPS = groupBySubsystem();

// Shared between the Recruits roster page and the Interview Day panel dashboard's
// "Edit" button on a recruit's profile card - both PATCH the exact same endpoint with
// the exact same field set, so one modal (and one set of validation-mirroring rules)
// serves both call sites instead of drifting apart.
//
// Deliberately NOT `course`-optional: PATCH /api/admin/recruitment/recruits/:id requires
// a non-empty course, so a caller that doesn't already have it on hand (the interview
// page's own RecruitProfile type doesn't carry it) must fetch the full record before
// opening this modal rather than opening it with a blank course and letting a save
// silently overwrite a real value with "" - see that call site's own fetch-on-open logic.
export interface EditableRecruit {
    id: string;
    name: string;
    reg_no: string;
    year: string;
    gender: string | null;
    department: string;
    course: string;
    phone: string;
    is_hosteller: boolean;
    hostel_block: string | null;
    hostel_room: string | null;
    day_scholar_area: string | null;
    travel_method: string | null;
    domains: string[];
}

export default function EditRecruitModal({
    recruit,
    onClose,
    onSaved,
}: {
    recruit: EditableRecruit;
    onClose: () => void;
    onSaved: (updated: EditableRecruit) => void;
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
    const [domains, setDomains] = useState<string[]>(recruit.domains || []);
    const [saving, setSaving] = useState(false);

    const toggleDomain = (key: string) =>
        setDomains((prev) => (prev.includes(key) ? prev.filter((d) => d !== key) : [...prev, key]));

    // Server-side re-validates this too (a recruit must have at least one domain) - this is
    // just so the button reflects an invalid state before the round-trip.
    const domainsValid = domains.length > 0;

    const save = async () => {
        if (!domainsValid) return;
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
                    // over from before the checkbox was toggled off - and the reverse for
                    // day_scholar_area/travel_method when toggled to hosteller.
                    hostel_block: isHosteller ? hostelBlock : null,
                    hostel_room: isHosteller ? hostelRoom : null,
                    day_scholar_area: isHosteller ? null : dayScholarArea,
                    travel_method: isHosteller ? null : travelMethod,
                    domains,
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
            <div className="w-full max-w-lg border border-white/10 bg-black p-6 max-h-[90vh] overflow-y-auto">
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

                    <div>
                        <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">
                            Domain(s)
                        </label>
                        <div className="space-y-3 border-0 bg-white/5 p-3 ring-1 ring-inset ring-white/10">
                            {DOMAIN_GROUPS.map((group) => (
                                <div key={group.subsystem}>
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mb-1.5">
                                        {group.subsystem}
                                    </p>
                                    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                                        {group.domains.map((d) => (
                                            <label key={d.key} className="flex items-center gap-2 text-sm text-gray-300">
                                                <input
                                                    type="checkbox"
                                                    checked={domains.includes(d.key)}
                                                    onChange={() => toggleDomain(d.key)}
                                                    className="border-white/20 bg-white/5 text-red focus:ring-red"
                                                />
                                                {d.label}
                                            </label>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                        {!domainsValid && (
                            <p className="mt-1.5 text-xs text-red-400">Select at least one domain.</p>
                        )}
                    </div>
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
                        disabled={saving || !domainsValid}
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
