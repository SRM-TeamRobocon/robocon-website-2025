"use client";

import React, { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import toast from "react-hot-toast";

const SESSION_LABELS: Record<string, string> = {
    day1Morning: "Day 1 — Morning",
    day1Evening: "Day 1 — Evening",
    day2Morning: "Day 2 — Morning",
    day2Evening: "Day 2 — Evening",
    day3Morning: "Day 3 — Morning",
    day3Evening: "Day 3 — Evening",
};

const SESSION_LABELS_SHORT: Record<string, string> = {
    day1Morning: "D1 AM",
    day1Evening: "D1 PM",
    day2Morning: "D2 AM",
    day2Evening: "D2 PM",
    day3Morning: "D3 AM",
    day3Evening: "D3 PM",
};

const SESSION_KEYS = Object.keys(SESSION_LABELS);

// Define the type locally to match the backend
interface RegistrationRow {
    rowIndex: number;
    name: string;
    regNumber: string;
    department: string;
    year: string;
    email: string;
    srmEmail: string;
    contact: string;
    whatsapp: string;
    hostel: string;
    room: string;
    workshop: string;
    paymentId: string;
    orderId: string;
    transactionId: string;
    paymentStatus: string;
    timestamp: string;
    attendance: string;
    day1Morning: string;
    day1Evening: string;
    day2Morning: string;
    day2Evening: string;
    day3Morning: string;
    day3Evening: string;
}

// A `border` doesn't render along a clip-path's angled edge, so the border is faked with
// a `::before` pseudo-element instead: same clip-path, inset -1px so its color peeks out
// uniformly around the real box, including along the diagonal cut corner.
const CARD_CLIP = "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)";

export default function EventDashboard() {
    const params = useParams();
    const eventName = typeof params.event === "string" ? params.event : "";

    const [data, setData] = useState<RegistrationRow[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    
    // Filters
    const [filter, setFilter] = useState("ALL"); // ALL, PENDING, VERIFIED
    const [sessionFilter, setSessionFilter] = useState("ALL"); // ALL or specific session key
    const [searchTerm, setSearchTerm] = useState("");
    
    const [role, setRole] = useState<string | null>(null);

    // Action states
    const [verifyingRow, setVerifyingRow] = useState<number | null>(null);
    const [updatingAttendance, setUpdatingAttendance] = useState<number | null>(null);

    const fetchData = React.useCallback(async () => {
        setLoading(true);
        try {
            const meRes = await fetch("/api/admin/me");
            const meJson = await meRes.json();
            if (meJson.success) {
                setRole(meJson.role);
            }

            const res = await fetch(`/api/admin/registrations?event=${eventName}`);
            const json = await res.json();
            if (json.success) {
                setData(json.data.reverse());
            } else {
                setError("Failed to fetch data.");
            }
        } catch (err) {
            setError("An error occurred while fetching data.");
        } finally {
            setLoading(false);
        }
    }, [eventName]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleVerify = async (row: RegistrationRow) => {
        setVerifyingRow(row.rowIndex);
        try {
            const res = await fetch("/api/admin/verify", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    rowIndex: row.rowIndex,
                    name: row.name,
                    phone: row.contact,
                    email: row.email,
                    workshop: row.workshop
                }),
            });
            const json = await res.json();

            if (json.success) {
                toast.success("Verified & Ticket Sent!");
                fetchData();
            } else {
                toast.error(json.error || "Unknown error occurred");
            }
        } catch (err) {
            toast.error("An unexpected error occurred.");
        } finally {
            setVerifyingRow(null);
        }
    };

    const handleToggleAttendance = async (row: RegistrationRow, session: string) => {
        setUpdatingAttendance(row.rowIndex);
        
        // Determine the inverse of the current status
        const currentStatus = row[session as keyof RegistrationRow] as string;
        const newStatus = currentStatus === "PRESENT" ? "ABSENT" : "PRESENT";

        try {
            const res = await fetch("/api/admin/update-attendance", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    rowIndex: row.rowIndex,
                    session: session,
                    status: newStatus
                }),
            });
            
            const json = await res.json();

            if (json.success) {
                toast.success(`Marked ${newStatus} for ${row.name}`);
                fetchData(); // Refresh UI
            } else {
                toast.error(json.error || "Failed to update attendance");
            }
        } catch (err) {
            toast.error("Network error updating attendance");
        } finally {
            setUpdatingAttendance(null);
        }
    };


    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

    const filteredData = data.filter((row) => {
        if (filter !== "ALL" && row.paymentStatus !== filter) return false;
        if (searchTerm) {
            const search = searchTerm.toLowerCase();
            return (
                row.name.toLowerCase().includes(search) ||
                row.regNumber.toLowerCase().includes(search) ||
                row.transactionId.toLowerCase().includes(search) ||
                row.email.toLowerCase().includes(search)
            );
        }
        return true;
    });

    const verifiedCount = data.filter(r => r.paymentStatus === "VERIFIED").length;
    const pendingCount = data.filter(r => r.paymentStatus === "PENDING").length;
    
    // Calculate session-specific attendance stats if a session is selected
    const checkedInCount = sessionFilter !== "ALL" 
        ? verifiedCount > 0 ? filteredData.filter(r => r[sessionFilter as keyof RegistrationRow] === "PRESENT").length : 0 
        : 0;

    const title = eventName ? `${capitalize(eventName)} Workshop` : "Workshop";

    return (
        <div>
            <div className="flex flex-col md:flex-row justify-between items-start mb-8 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white mb-2">{title} <span className="text-gray-500 font-normal">| Participants</span></h1>
                    <p className="text-gray-400">Total: {data.length} registrants</p>
                </div>

                <div className="flex flex-wrap gap-3 items-end">
                    <div
                        className="relative isolate bg-emerald-500/10 px-4 py-2 flex items-center gap-3 shadow-inner before:content-[''] before:absolute before:-inset-px before:-z-10 before:[clip-path:var(--clip)] before:bg-emerald-500/20"
                        style={{ clipPath: CARD_CLIP, "--clip": CARD_CLIP } as any}
                    >
                        <span className="text-emerald-500/80">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </span>
                        <div>
                            <p className="text-xs text-emerald-400/80 uppercase font-bold tracking-wider">Verified</p>
                            <p className="text-lg text-white font-bold">{verifiedCount}</p>
                        </div>
                    </div>

                    <div
                        className="relative isolate bg-amber-500/10 px-4 py-2 flex items-center gap-3 shadow-inner before:content-[''] before:absolute before:-inset-px before:-z-10 before:[clip-path:var(--clip)] before:bg-amber-500/20"
                        style={{ clipPath: CARD_CLIP, "--clip": CARD_CLIP } as any}
                    >
                        <span className="text-amber-500/80">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </span>
                        <div>
                            <p className="text-xs text-amber-400/80 uppercase font-bold tracking-wider">Pending</p>
                            <p className="text-lg text-white font-bold">{pendingCount}</p>
                        </div>
                    </div>

                    {sessionFilter !== "ALL" && (
                        <div
                            className="relative isolate bg-indigo-500/10 px-4 py-2 flex items-center gap-3 shadow-inner before:content-[''] before:absolute before:-inset-px before:-z-10 before:[clip-path:var(--clip)] before:bg-indigo-500/20"
                            style={{ clipPath: CARD_CLIP, "--clip": CARD_CLIP } as any}
                        >
                            <span className="text-indigo-500/80">
                                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" /></svg>
                            </span>
                            <div>
                                <p className="text-xs text-indigo-400/80 uppercase font-bold tracking-wider">Present</p>
                                <p className="text-lg text-white font-bold">{checkedInCount}</p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Attendance Manager Warning Bar */}
            {sessionFilter !== "ALL" && (
                <div
                    className="relative isolate mb-4 bg-indigo-500/10 p-3 flex items-center gap-3 backdrop-blur-md before:content-[''] before:absolute before:-inset-px before:-z-10 before:[clip-path:var(--clip)] before:bg-indigo-500/30"
                    style={{ clipPath: CARD_CLIP, "--clip": CARD_CLIP } as any}
                >
                    <div className="p-2 bg-indigo-500/20">
                        <svg className="w-5 h-5 text-indigo-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    </div>
                    <div>
                        <p className="text-sm text-indigo-200 font-medium">
                            <strong className="text-indigo-300">Attendance Manager Mode:</strong> You are viewing <span className="font-bold underline">{SESSION_LABELS[sessionFilter]}</span>. You can now manually check people in and out below.
                        </p>
                    </div>
                </div>
            )}

            <div
                className="relative isolate bg-gray-900/50 shadow-2xl backdrop-blur-sm before:content-[''] before:absolute before:-inset-px before:-z-10 before:[clip-path:var(--clip)] before:bg-gray-800"
                style={{ clipPath: CARD_CLIP, "--clip": CARD_CLIP } as any}
            >

                {/* Controls Bar */}
                <div className="p-4 border-b border-gray-800 flex flex-col xl:flex-row gap-4 justify-between bg-gray-900/80">
                    <div className="relative max-w-md w-full">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="w-5 h-5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                        </div>
                        <input
                            type="text"
                            placeholder="Search name, reg no, UTR..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="bg-gray-800/80 border border-gray-700 text-white text-sm focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 p-2.5 transition-colors"
                        />
                    </div>

                    <div className="flex flex-wrap gap-4 items-center justify-end">
                        
                        {/* Attendance Session Filter Dropdown */}
                        <div className="flex items-center gap-2 bg-gray-800/40 p-1.5 border border-gray-700/50">
                            <span className="text-[10px] uppercase tracking-wider font-bold text-gray-500 px-2">View:</span>
                            <select
                                value={sessionFilter}
                                onChange={(e) => setSessionFilter(e.target.value)}
                                className="appearance-none bg-gray-800/80 border border-gray-600 text-white text-xs font-semibold pl-3 pr-8 py-2 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none cursor-pointer transition-colors"
                            >
                                <option value="ALL">All Sessions Overview</option>
                                <optgroup label="Manage Attendance">
                                    {SESSION_KEYS.map(key => (
                                        <option key={key} value={key}>{SESSION_LABELS[key]}</option>
                                    ))}
                                </optgroup>
                            </select>
                        </div>

                        {/* Payment Filter Buttons */}
                        <div className="flex gap-2">
                            {["ALL", "PENDING", "VERIFIED"].map((f) => (
                                <button
                                    key={f}
                                    onClick={() => setFilter(f)}
                                    className={`px-4 py-2 text-xs font-bold transition-all ${filter === f
                                        ? "bg-blue-600 text-white shadow-lg shadow-blue-500/20"
                                        : "bg-gray-800 text-gray-400 hover:bg-gray-700 hover:text-white"
                                        }`}
                                >
                                    {f}
                                </button>
                            ))}
                            <button onClick={fetchData} className="px-3 py-2 bg-gray-800 hover:bg-gray-700 transition-colors border border-gray-700 group" title="Refresh Data">
                                <svg className="w-4 h-4 text-gray-300 group-hover:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                            </button>
                        </div>

                    </div>
                </div>

                {/* Table View */}
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left text-gray-400">
                        <thead className="text-xs text-gray-400 uppercase bg-gray-800/50 border-b border-gray-800">
                            <tr>
                                <th scope="col" className="px-6 py-4">Timestamp</th>
                                <th scope="col" className="px-6 py-4">Participant Details</th>
                                <th scope="col" className="px-6 py-4">Payment Info</th>
                                <th scope="col" className="px-6 py-4 text-center">Status</th>
                                <th scope="col" className="px-6 py-4 text-center">
                                    {sessionFilter === "ALL" ? "All Attendance" : `Attendance: ${SESSION_LABELS_SHORT[sessionFilter]}`}
                                </th>
                                <th scope="col" className="px-6 py-4 text-right">Action</th>
                            </tr>
                        </thead>
                        <tbody>
                            {loading ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500">
                                        <div className="flex justify-center flex-col items-center">
                                            <div className="w-8 h-8 rounded-full border-4 border-blue-500/30 border-t-blue-500 animate-spin mb-3"></div>
                                            Fetching latest rows from Google Sheets...
                                        </div>
                                    </td>
                                </tr>
                            ) : error ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-8 text-center text-red-400 bg-red-500/5">{error}</td>
                                </tr>
                            ) : filteredData.length === 0 ? (
                                <tr>
                                    <td colSpan={6} className="px-6 py-12 text-center text-gray-500 italic">No registrations found matching the criteria.</td>
                                </tr>
                            ) : (
                                filteredData.map((row) => (
                                    <tr key={row.rowIndex} className={`border-b border-gray-800/80 transition-colors ${
                                        sessionFilter !== "ALL" && row[sessionFilter as keyof RegistrationRow] === "PRESENT" 
                                            ? "bg-indigo-900/10 hover:bg-indigo-900/20" 
                                            : "hover:bg-gray-800/30"
                                    }`}>
                                        <td className="px-6 py-4 align-top whitespace-nowrap">
                                            <div className="text-white font-medium">{new Date(row.timestamp).toLocaleDateString()}</div>
                                            <div className="text-xs text-gray-500">{new Date(row.timestamp).toLocaleTimeString()}</div>
                                        </td>

                                        <td className="px-6 py-4 align-top">
                                            <div className="font-medium text-white text-base mb-1">{row.name}</div>
                                            <div className="text-xs space-y-0.5">
                                                <div className="flex items-center gap-2"><span className="text-gray-500 w-12 tracking-wide">REG No:</span> <span className="text-gray-300 font-mono">{row.regNumber}</span></div>
                                                <div className="flex items-center gap-2"><span className="text-gray-500 w-12 tracking-wide">Dept:</span> <span className="text-gray-300">{row.department}</span></div>
                                                <div className="flex items-center gap-2"><span className="text-gray-500 w-12 tracking-wide">Email:</span> <span className="text-gray-300">{row.email}</span></div>
                                                <div className="flex items-center gap-2"><span className="text-gray-500 w-12 tracking-wide">Phone:</span> <span className="text-gray-300">{row.contact}</span></div>
                                                {(row.hostel && row.hostel !== "Day Scholar") && (
                                                    <div className="flex items-center gap-2"><span className="text-gray-500 w-12 tracking-wide">Hostel:</span> <span className="text-purple-300">{row.hostel} - {row.room}</span></div>
                                                )}
                                                {row.hostel === "Day Scholar" && (
                                                    <div className="flex items-center gap-2"><span className="text-gray-500 w-12 tracking-wide">Hostel:</span> <span className="text-blue-300">Day Scholar</span></div>
                                                )}
                                            </div>
                                        </td>

                                        <td className="px-6 py-4 align-top">
                                            <div className="bg-gray-800/50 p-2 border border-gray-700/50 inline-block min-w-[200px]">
                                                <div className="text-[10px] uppercase text-gray-500 font-bold tracking-wider mb-1">Transaction (UTR) ID</div>
                                                <div className="font-mono text-white text-sm tracking-widest">{row.transactionId || 'N/A'}</div>
                                            </div>
                                        </td>

                                        <td className="px-6 py-4 align-middle text-center">
                                            {row.paymentStatus === 'VERIFIED' ? (
                                                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold w-max">
                                                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                    VERIFIED
                                                </div>
                                            ) : (
                                                <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-amber-500/10 border border-amber-500/20 text-amber-500 text-xs font-bold w-max">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
                                                    PENDING
                                                </div>
                                            )}
                                        </td>

                                        {/* Attendance Column */}
                                        <td className="px-6 py-4 align-middle">
                                            {sessionFilter === "ALL" ? (
                                                <div className="flex flex-wrap gap-1 justify-center w-max max-w-[120px] mx-auto">
                                                    {SESSION_KEYS.map((sess) => {
                                                        const isPresent = row[sess as keyof RegistrationRow] === "PRESENT";
                                                        return (
                                                            <span
                                                                key={sess}
                                                                className={`inline-block px-1.5 py-0.5 text-[9px] font-bold border ${isPresent
                                                                    ? "bg-blue-500/15 border-blue-500/30 text-blue-300"
                                                                    : "bg-gray-800/60 border-gray-700/40 text-gray-600"
                                                                    }`}
                                                            >
                                                                {SESSION_LABELS_SHORT[sess]}
                                                            </span>
                                                        );
                                                    })}
                                                </div>
                                            ) : (
                                                <div className="flex justify-center">
                                                    {row[sessionFilter as keyof RegistrationRow] === "PRESENT" ? (
                                                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-500/10 border border-blue-500/30 text-blue-400 text-xs font-bold shadow-[0_0_10px_rgba(59,130,246,0.1)]">
                                                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                                            CHECKED IN
                                                        </div>
                                                    ) : (
                                                        <span className="text-gray-600 text-[10px] uppercase font-bold italic py-1">Missing</span>
                                                    )}
                                                </div>
                                            )}
                                        </td>

                                        <td className="px-6 py-4 align-middle text-right">
                                            {/* Action when Payment is PENDING */}
                                            {row.paymentStatus === 'PENDING' && (
                                                role === 'lead' ? (
                                                    <button
                                                        onClick={() => handleVerify(row)}
                                                        disabled={verifyingRow === row.rowIndex}
                                                        className={`inline-flex items-center justify-center px-4 py-2 text-sm font-semibold transition-all shadow-md active:scale-95 whitespace-nowrap ${verifyingRow === row.rowIndex
                                                            ? "bg-gray-700 text-gray-400 cursor-not-allowed"
                                                            : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20"
                                                            }`}
                                                    >
                                                        {verifyingRow === row.rowIndex ? (
                                                            <>
                                                                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                                                                Verifying
                                                            </>
                                                        ) : (
                                                            'Verify & Send Ticket'
                                                        )}
                                                    </button>
                                                ) : (
                                                    <span className="text-gray-600 text-[10px] uppercase font-bold italic">Lead Access Required</span>
                                                )
                                            )}

                                            {/* Action when Payment is VERIFIED AND Session Mode is ON */}
                                            {row.paymentStatus === 'VERIFIED' && sessionFilter !== 'ALL' && (
                                                role === 'lead' ? (
                                                    <button
                                                        onClick={() => handleToggleAttendance(row, sessionFilter)}
                                                        disabled={updatingAttendance === row.rowIndex}
                                                        className={`inline-flex items-center justify-center px-4 py-1.5 text-xs font-bold transition-all shadow-md active:scale-95 whitespace-nowrap min-w-[140px] ${updatingAttendance === row.rowIndex
                                                            ? "bg-gray-700 text-gray-500 cursor-not-allowed"
                                                            : row[sessionFilter as keyof RegistrationRow] === "PRESENT"
                                                                ? "bg-gray-800 hover:bg-red-500/20 border border-gray-700 hover:border-red-500/50 text-gray-400 hover:text-red-400" 
                                                                : "bg-indigo-600 hover:bg-indigo-500 text-white shadow-indigo-500/20"
                                                            }`}
                                                    >
                                                        {updatingAttendance === row.rowIndex ? (
                                                             "Updating..."
                                                        ) : row[sessionFilter as keyof RegistrationRow] === "PRESENT" ? (
                                                            "UNDO / Mark Absent"
                                                        ) : (
                                                            "Mark Present"
                                                        )}
                                                    </button>
                                                ) : (
                                                    <span className="text-gray-600 text-[10px] uppercase font-bold italic">Lead Access Required</span>
                                                )
                                            )}
                                            
                                            {row.paymentStatus === 'VERIFIED' && sessionFilter === 'ALL' && (
                                                <span className="text-gray-600 text-[10px] uppercase font-bold italic px-2">Manage in specific view</span>
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}
