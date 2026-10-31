"use client";

import { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import { ArrowUpRight, CalendarDays, ChevronLeft, ChevronRight, RefreshCw, Search } from "lucide-react";
import { useRequireRole } from "@/hooks/use-require-role";

type DataRow = Record<string, unknown>;
type Tab = "Overview" | "Attendance" | "Timetable" | "Courses" | "Marks" | "Calendar" | "Circulars";

const TABS: Tab[] = ["Overview", "Attendance", "Timetable", "Courses", "Marks", "Calendar", "Circulars"];
const hasText = (value: unknown): value is string | number => typeof value === "string" || typeof value === "number";
const records = (value: unknown): DataRow[] => Array.isArray(value) ? value.filter((item): item is DataRow => Boolean(item) && typeof item === "object" && !Array.isArray(item)) : [];
const display = (value: unknown) => value === null || value === undefined || value === "" ? "—" : hasText(value) ? String(value) : "";

function field(row: DataRow | undefined, ...names: string[]) {
    if (!row) return undefined;
    for (const name of names) {
        const key = Object.keys(row).find((candidate) => candidate.toLowerCase() === name.toLowerCase());
        if (key && row[key] !== null && row[key] !== undefined && row[key] !== "") return row[key];
    }
    return undefined;
}

function dateLabel(value: unknown) {
    if (typeof value !== "string") return display(value);
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})/);
    return match ? new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3])).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : value;
}

function calendarKey(date: Date) {
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function eventDate(value: unknown) {
    return typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value) ? value.slice(0, 10) : "";
}

function EmptyState({ title, detail }: { title: string; detail: string }) {
    return <div className="py-12 text-center"><CalendarDays className="mx-auto h-5 w-5 text-gray-500" /><h3 className="mt-3 text-sm font-semibold text-white">{title}</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-400">{detail}</p></div>;
}

function ProfilePanel({ profile }: { profile: DataRow }) {
    const name = display(field(profile, "name", "student_name"));
    const details = [
        ["Registration number", field(profile, "registration_number", "register_number", "reg_no")],
        ["Programme", field(profile, "program", "programme")],
        ["Department", field(profile, "department")],
        ["Specialization", field(profile, "specialization", "branch")],
        ["Semester", field(profile, "semester")],
        ["Batch", field(profile, "batch")],
    ].filter(([, value]) => value !== undefined);
    const advisor = display(field(profile, "faculty_advisor_name", "Faculty Advisor", "academic_advisor_name", "Academic Advisor"));
    const advisorEmail = display(field(profile, "faculty_advisor_email", "Faculty Advisor Email", "academic_advisor_email", "Academic Advisor Email"));

    return <section aria-label="Student profile" className="pt-1">
        <h2 className="text-xl font-semibold text-white">{name}</h2>
        <p className="mt-1 text-sm text-gray-400">{[field(profile, "program", "programme"), field(profile, "department")].filter(Boolean).join(" · ") || "Student profile"}</p>
        {details.length > 0 && <dl className="mt-7 grid gap-x-10 gap-y-5 sm:grid-cols-2 lg:grid-cols-3">{details.map(([label, value]) => <div key={String(label)}><dt className="text-xs text-gray-500">{String(label)}</dt><dd className="mt-1 text-sm text-gray-200">{display(value)}</dd></div>)}</dl>}
        {(advisor !== "—" || advisorEmail !== "—") && <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 border-t border-white/10 pt-4 text-sm"><span className="text-gray-400">Faculty advisor <span className="text-gray-200">{advisor}</span></span>{advisorEmail !== "—" && <a href={`mailto:${advisorEmail}`} className="inline-flex items-center gap-1 text-red hover:text-white">{advisorEmail}<ArrowUpRight className="h-3 w-3" /></a>}</div>}
    </section>;
}

function CourseGrid({ courses, query = "" }: { courses: DataRow[]; query?: string }) {
    const filtered = courses.filter((course) => !query || JSON.stringify(course).toLowerCase().includes(query.toLowerCase()));
    if (!filtered.length) return <EmptyState title={courses.length ? "No matching courses" : "No registered courses found"} detail={courses.length ? "Try a different course name or code." : "Registered subjects will appear here when Edutech returns them."} />;
    return <div className="divide-y divide-white/10 border-y border-white/10">{filtered.map((course, index) => <article key={`${display(field(course, "course_code", "code"))}-${index}`} className="py-5">
        <div className="flex items-start justify-between gap-3"><div><p className="text-[11px] tracking-wide text-red">{display(field(course, "course_code", "code"))}</p><h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-white">{display(field(course, "course_title", "course_name", "name", "title"))}</h3></div><span className="shrink-0 border border-white/10 px-2 py-1 text-[10px] text-gray-400">{display(field(course, "course_type", "type", "category"))}</span></div>
        <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-white/[0.07] pt-3 text-xs"><div><p className="text-gray-600">Faculty</p><p className="mt-1 truncate text-gray-300">{display(field(course, "faculty", "faculty_name", "instructor"))}</p></div><div><p className="text-gray-600">Slot / room</p><p className="mt-1 truncate text-gray-300">{[field(course, "slot"), field(course, "room_no", "room")].filter(Boolean).map(display).join(" · ") || "—"}</p></div><div><p className="text-gray-600">Credits</p><p className="mt-1 text-gray-300">{display(field(course, "credit", "credits"))}</p></div><div><p className="text-gray-600">Category</p><p className="mt-1 truncate text-gray-300">{display(field(course, "category", "regn_type"))}</p></div></div>
    </article>)}</div>;
}

function AttendanceView({ items, query }: { items: DataRow[]; query: string }) {
    const filtered = items.filter((item) => !query || JSON.stringify(item).toLowerCase().includes(query.toLowerCase()));
    if (!filtered.length) return <EmptyState title={items.length ? "No matching attendance" : "No attendance records returned"} detail={items.length ? "Try another search term." : "Edutech returned no attendance for this SRM account. Check the same account in Edutech, then refresh here."} />;
    return <div className="divide-y divide-white/10 border-y border-white/10">{filtered.map((item, index) => {
        const attended = field(item, "classes_attended", "attended", "present", "present_count");
        const conducted = field(item, "classes_conducted", "conducted", "total", "total_classes");
        const percentValue = field(item, "attendance_percentage", "percentage", "attendance_percent", "percent");
        const percent = typeof percentValue === "number" ? percentValue : typeof percentValue === "string" ? Number.parseFloat(percentValue) : NaN;
        const code = display(field(item, "course_code", "code", "subject_code"));
        const title = display(field(item, "course_title", "course_name", "subject", "name", "title"));
        return <article key={`${code}-${index}`} className="grid gap-4 py-5 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="min-w-0"><p className="text-[10px] text-gray-500">{code !== "—" ? code : `COURSE ${String(index + 1).padStart(2, "0")}`}</p><h3 className="mt-1 truncate text-sm font-semibold text-white">{title !== "—" ? title : "Attendance record"}</h3>{Number.isFinite(percent) && <div className="mt-3 h-1.5 bg-white/10"><div className={`h-full ${percent < 75 ? "bg-amber-400" : "bg-emerald-400"}`} style={{ width: `${Math.max(0, Math.min(100, percent))}%` }} /></div>}</div>
            <div className="flex items-center gap-5 sm:justify-end"><div><p className="text-[10px] text-gray-600">Attended</p><p className="mt-1 text-sm text-gray-200">{attended !== undefined && conducted !== undefined ? `${display(attended)} / ${display(conducted)}` : display(attended)}</p></div><div className="min-w-16 text-right"><p className="text-[10px] text-gray-600">Attendance</p><p className={`mt-1 text-lg font-bold ${Number.isFinite(percent) && percent < 75 ? "text-amber-300" : "text-white"}`}>{Number.isFinite(percent) ? `${percent.toFixed(1)}%` : display(percentValue)}</p></div></div>
        </article>;
    })}</div>;
}

function TimetableView({ classes, query }: { classes: DataRow[]; query: string }) {
    const orders = [1, 2, 3, 4, 5];
    const [dayOrder, setDayOrder] = useState(1);
    const current = classes.filter((item) => Number(field(item, "day_order", "dayOrder")) === dayOrder)
        .filter((item) => !query || JSON.stringify(item).toLowerCase().includes(query.toLowerCase()))
        .sort((a, b) => Number(field(a, "hour", "period")) - Number(field(b, "hour", "period")));
    const dayName = display(field(current[0], "day_key", "day"));

    return <div className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3"><div><h3 className="text-sm font-semibold text-white">Day order timetable</h3><p className="mt-1 text-xs text-gray-500">Your weekly classes grouped by SRM day order.</p></div><div className="flex border border-white/10">{orders.map((order) => <button key={order} onClick={() => setDayOrder(order)} aria-pressed={dayOrder === order} className={`min-w-12 border-r border-white/10 px-3 py-2 text-xs last:border-r-0 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red ${dayOrder === order ? "bg-red text-white" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}>DO{order}</button>)}</div></div>
        {dayName !== "—" && <p className="text-xs text-gray-500">{dayName}</p>}
        {!classes.length ? <EmptyState title="Timetable is not available" detail="Your class schedule will appear here when SRM Academia returns it." /> : !current.length ? <EmptyState title={`No classes for DO${dayOrder}`} detail="Choose another day order or clear the search." /> : <div className="divide-y divide-white/10 border-y border-white/10">{current.map((item, index) => <article key={`${display(field(item, "slot", "time"))}-${index}`} className="grid gap-2 py-4 sm:grid-cols-[7rem_minmax(0,1fr)_9rem] sm:gap-4">
            <p className="text-sm text-gray-400">{display(field(item, "time", "slot"))}</p>
            <div className="min-w-0"><p className="text-sm font-semibold text-white">{display(field(item, "name", "course_title", "course_name"))}</p><p className="mt-1 text-xs text-gray-400">{display(field(item, "code", "course_code"))} · {display(field(item, "type", "course_type"))}</p></div>
            <div className="text-xs text-gray-400 sm:text-right"><p>{display(field(item, "room", "room_no"))}</p><p className="mt-1">{display(field(item, "faculty", "faculty_name"))}</p></div>
        </article>)}</div>}
    </div>;
}

function MarksView({ items, query }: { items: DataRow[]; query: string }) {
    const filtered = items.filter((item) => !query || JSON.stringify(item).toLowerCase().includes(query.toLowerCase()));
    if (!filtered.length) return <EmptyState title={items.length ? "No matching marks" : "Marks are not available yet"} detail={items.length ? "Try another search term." : "Assessment results will appear here when SRM Academia publishes them."} />;
    return <div className="divide-y divide-white/10 border-y border-white/10">{filtered.map((item, index) => {
        const title = display(field(item, "course_title", "course_name", "subject", "name", "title", "assessment_name", "exam_name"));
        const score = display(field(item, "marks_obtained", "score", "marks", "obtained", "grade"));
        const maximum = display(field(item, "max_marks", "total_marks", "out_of", "maximum"));
        return <article key={index} className="flex items-center justify-between gap-4 py-5"><div><p className="text-[10px] text-red">{display(field(item, "course_code", "code", "assessment_type"))}</p><h3 className="mt-1 text-sm font-semibold text-white">{title !== "—" ? title : "Assessment result"}</h3><p className="mt-1 text-xs text-gray-500">{display(field(item, "date", "exam_date", "semester"))}</p></div><p className="shrink-0 text-right text-xl font-bold text-white">{score}{maximum !== "—" && <span className="text-sm font-normal text-gray-500"> / {maximum}</span>}</p></article>;
    })}</div>;
}

function CalendarView({ events, holidays }: { events: DataRow[]; holidays: DataRow[] }) {
    const [month, setMonth] = useState(() => { const now = new Date(); return new Date(now.getFullYear(), now.getMonth(), 1); });
    const [selectedDate, setSelectedDate] = useState(() => calendarKey(new Date()));
    const today = calendarKey(new Date());
    const days = new Map<string, { event?: DataRow; holidays: DataRow[] }>();

    for (const event of events) {
        const key = eventDate(field(event, "date"));
        if (!key) continue;
        const entry = days.get(key) || { holidays: [] };
        entry.event = event;
        days.set(key, entry);
    }
    for (const holiday of holidays) {
        const key = eventDate(field(holiday, "date"));
        if (!key) continue;
        const entry = days.get(key) || { holidays: [] };
        entry.holidays.push(holiday);
        days.set(key, entry);
    }

    const year = month.getFullYear();
    const monthIndex = month.getMonth();
    const firstWeekday = (new Date(year, monthIndex, 1).getDay() + 6) % 7;
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const cellCount = Math.ceil((firstWeekday + daysInMonth) / 7) * 7;
    const dates = Array.from({ length: cellCount }, (_, index) => new Date(year, monthIndex, index - firstWeekday + 1));
    const selected = days.get(selectedDate);

    const moveMonth = (offset: number) => {
        const next = new Date(year, monthIndex + offset, 1);
        setMonth(next);
        setSelectedDate(calendarKey(next));
    };

    return <div className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_16rem]">
        <section aria-label="Academic calendar" className="min-w-0">
            <header className="mb-5 flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold text-white">{month.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</h2>
                <div className="flex items-center gap-1">
                    <button type="button" onClick={() => { const now = new Date(); setMonth(new Date(now.getFullYear(), now.getMonth(), 1)); setSelectedDate(calendarKey(now)); }} className="min-h-10 px-3 text-sm text-gray-300 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-red">Today</button>
                    <button type="button" onClick={() => moveMonth(-1)} aria-label="Previous month" className="grid h-10 w-10 place-items-center text-gray-300 hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-red"><ChevronLeft className="h-4 w-4" /></button>
                    <button type="button" onClick={() => moveMonth(1)} aria-label="Next month" className="grid h-10 w-10 place-items-center text-gray-300 hover:bg-white/5 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-red"><ChevronRight className="h-4 w-4" /></button>
                </div>
            </header>
            <div className="mb-2 grid grid-cols-7 text-center text-xs text-gray-500">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => <span key={day}>{day}</span>)}</div>
            <div className="grid grid-cols-7 gap-px border border-white/10 bg-white/10">{dates.map((date) => {
                const key = calendarKey(date);
                const entry = days.get(key);
                const order = field(entry?.event, "day_order", "dayOrder");
                const inMonth = date.getMonth() === monthIndex;
                const isSelected = key === selectedDate;
                return <button key={key} type="button" onClick={() => { setSelectedDate(key); if (!inMonth) setMonth(new Date(date.getFullYear(), date.getMonth(), 1)); }} aria-label={`${date.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}${order !== undefined ? `, day order ${display(order)}` : ""}${entry?.holidays.length ? ", holiday" : ""}`} aria-pressed={isSelected} className={`flex min-h-[4.5rem] min-w-0 flex-col items-start gap-1.5 p-2 text-left transition-colors focus-visible:relative focus-visible:z-10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red sm:min-h-24 sm:p-3 ${isSelected ? "bg-white/15" : "bg-[#0b0d0f] hover:bg-white/5"} ${inMonth ? "text-white" : "text-gray-600"}`}>
                    <span className={`text-sm ${key === today ? "font-semibold text-red" : ""}`}>{date.getDate()}</span>
                    {order !== undefined && <span className="text-[10px] text-gray-300">DO{display(order)}</span>}
                    {Boolean(entry?.holidays.length) && <span aria-hidden="true" className="h-1.5 w-1.5 bg-red" />}
                </button>;
            })}</div>
            <p className="mt-3 flex items-center gap-2 text-xs text-gray-400"><span className="h-1.5 w-1.5 bg-red" /> Holiday</p>
        </section>
        <aside aria-label="Selected date" className="border-t border-white/10 pt-5 xl:border-l xl:border-t-0 xl:pl-6 xl:pt-0">
            <p className="text-xs text-gray-400">Selected date</p>
            <h3 className="mt-2 text-base font-semibold text-white">{new Date(`${selectedDate}T00:00:00`).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h3>
            {selected?.event && <div className="mt-6 border-t border-white/10 pt-4"><p className="text-xs text-gray-400">Day order</p><p className="mt-1 text-lg font-semibold text-white">DO{display(field(selected.event, "day_order", "dayOrder"))}</p></div>}
            {selected?.holidays.map((holiday, index) => <div key={index} className="mt-5 border-t border-white/10 pt-4"><p className="text-xs text-gray-400">Holiday</p><p className="mt-1 text-sm text-white">{display(field(holiday, "event", "name", "title", "holiday"))}</p></div>)}
            {!selected?.event && !selected?.holidays.length && <p className="mt-6 text-sm leading-6 text-gray-400">No academic events listed for this date.</p>}
        </aside>
    </div>;
}

function CircularsView({ items, query }: { items: DataRow[]; query: string }) {
    const filtered = items.filter((item) => !query || JSON.stringify(item).toLowerCase().includes(query.toLowerCase()));
    if (!filtered.length) return <EmptyState title="No circulars available" detail="New notices will appear here when Edutech publishes them." />;
    return <div className="divide-y divide-white/[0.07] border-y border-white/10">{filtered.map((item, index) => <article key={index} className="grid gap-3 py-5 sm:grid-cols-[1fr_auto]"><div><h3 className="text-base font-semibold text-white">{display(field(item, "title", "subject", "heading", "name"))}</h3><p className="mt-2 whitespace-pre-line text-sm leading-6 text-gray-400">{display(field(item, "description", "message", "body", "content", "details"))}</p></div><p className="text-xs text-gray-600">{dateLabel(field(item, "date", "published_at", "created_at"))}</p></article>)}</div>;
}

export default function AcademiaPage() {
    const ready = useRequireRole(["member", "lead", "admin"]);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [connected, setConnected] = useState(false);
    const [data, setData] = useState<DataRow | null>(null);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState("");
    const [activeTab, setActiveTab] = useState<Tab>("Overview");
    const [query, setQuery] = useState("");

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch("/api/member/academia");
            const result = await response.json();
            if (!response.ok) {
                if (response.status === 401 || response.status === 403) {
                    setConnected(false); setData(null); setLoadError("");
                } else {
                    setLoadError(result.error || "Could not load academic data. Try again.");
                }
                return false;
            }
            setLoadError("");
            setConnected(true);
            setData(result.data as DataRow);
            return true;
        } catch {
            setLoadError("Could not reach SRM Academia. Try again.");
            return false;
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { if (ready) void load(); }, [ready, load]);

    const connect = async (event: React.FormEvent) => {
        event.preventDefault();
        setLoading(true);
        try {
            const response = await fetch("/api/member/academia", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username, password }) });
            const result = await response.json();
            if (!response.ok) throw new Error(result.error || "Could not connect.");
            if (!(await load())) throw new Error("Connected, but academic data could not be loaded. Refresh to try again.");
            toast.success("SRM Academia connected.");
        } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not connect.");
            setLoading(false);
        } finally {
            setPassword("");
        }
    };

    const disconnect = async () => {
        const response = await fetch("/api/member/academia", { method: "DELETE" });
        if (!response.ok) { toast.error("Could not disconnect Academia."); return; }
        setConnected(false); setData(null); setLoadError(""); setActiveTab("Overview"); setQuery("");
    };

    const dashboard = (data?.dashboard && typeof data.dashboard === "object" ? data.dashboard : {}) as DataRow;
    const timetable = (data?.timetable && typeof data.timetable === "object" ? data.timetable : {}) as DataRow;
    const calendar = (data?.calendar && typeof data.calendar === "object" ? data.calendar : {}) as DataRow;
    const profile = (dashboard.profile && typeof dashboard.profile === "object" ? dashboard.profile : {}) as DataRow;
    const attendance = records(dashboard.attendance);
    const marks = records(dashboard.marks);
    const courses = records(dashboard.personal_timetable);
    const classes = records(timetable.timetable_by_day_order).filter((item) => field(item, "is_my_class") === true);
    const planner = (calendar.academic_planner && typeof calendar.academic_planner === "object" ? calendar.academic_planner : dashboard.academic_planner || {}) as DataRow;
    const dayOrders = records(planner.day_order_schedule);
    const holidays = records(planner.holidays);
    const circulars = records(data?.circulars);

    if (!ready) return null;

    return <div className="mx-auto max-w-6xl space-y-8 pb-10">
        <header className="flex flex-wrap items-end justify-between gap-4 border-b border-white/10 pb-6">
            <div>
                <h1 className="text-3xl font-semibold tracking-tight text-white">Academia</h1>
                <p className="mt-2 text-sm text-gray-400">Your SRM academic records</p>
            </div>
            {connected && <div className="flex items-center gap-2">
                <span className="mr-2 flex items-center gap-2 text-xs text-gray-400"><span className="h-1.5 w-1.5 bg-emerald-400" />Connected</span>
                <button type="button" onClick={() => void load()} disabled={loading} className="inline-flex min-h-11 items-center gap-2 border border-white/15 px-4 text-sm text-white transition-colors hover:bg-white/5 active:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-red disabled:opacity-50"><RefreshCw className={`h-4 w-4 ${loading ? "animate-spin motion-reduce:animate-none" : ""}`} />Refresh</button>
                <button type="button" onClick={() => void disconnect()} className="min-h-11 px-3 text-sm text-gray-400 transition-colors hover:text-white active:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-red">Disconnect</button>
            </div>}
        </header>

        {loadError && <section role="alert" className="flex flex-wrap items-center justify-between gap-3 border border-amber-400/30 px-4 py-3 text-sm text-amber-100"><span>{loadError}</span><button type="button" onClick={() => void load()} disabled={loading} className="min-h-10 px-3 text-sm text-amber-100 underline underline-offset-4 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-red disabled:opacity-50">Retry</button></section>}

        {loading && !connected ? <p role="status" className="py-12 text-sm text-gray-400">Checking your Academia session…</p> : !connected ? <section className="max-w-md space-y-6">
            <div><h2 className="text-xl font-semibold text-white">Connect your SRM account</h2><p className="mt-2 text-sm leading-6 text-gray-400">Sign in to view your attendance, timetable, courses and marks.</p></div>
            <form onSubmit={connect} className="space-y-4">
                <label className="block text-sm text-gray-300">SRM username<input autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} className="mt-2 block min-h-11 w-full border border-white/20 bg-transparent px-3 text-sm text-white outline-none focus:border-red focus-visible:ring-1 focus-visible:ring-red" /></label>
                <label className="block text-sm text-gray-300">SRM password<input type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-2 block min-h-11 w-full border border-white/20 bg-transparent px-3 text-sm text-white outline-none focus:border-red focus-visible:ring-1 focus-visible:ring-red" /></label>
                <button disabled={loading} className="min-h-11 w-full bg-red px-4 text-sm font-semibold text-white transition-colors hover:bg-red/80 active:bg-red/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red disabled:opacity-50">{loading ? "Connecting…" : "Connect Academia"}</button>
            </form>
            <p className="text-xs leading-5 text-gray-400">Your SRM password is not saved. Sign in again when your session expires.</p>
        </section> : <>
            <div className="flex flex-col gap-4 border-b border-white/10 sm:flex-row sm:items-center sm:justify-between">
                <nav aria-label="Academic sections" className="flex min-w-0 gap-1 overflow-x-auto">{TABS.map((tab) => <button key={tab} type="button" onClick={() => { setActiveTab(tab); setQuery(""); }} aria-pressed={activeTab === tab} className={`min-h-11 shrink-0 border-b-2 px-3 text-sm transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-red ${activeTab === tab ? "border-red text-white" : "border-transparent text-gray-400 hover:text-white"}`}>{tab}</button>)}</nav>
                {activeTab !== "Overview" && activeTab !== "Calendar" && <label className="relative block w-full pb-3 sm:w-52"><Search className="absolute left-3 top-3 h-4 w-4 text-gray-500" /><span className="sr-only">Search this section</span><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search" className="min-h-10 w-full border border-white/15 bg-transparent pl-9 pr-3 text-sm text-white outline-none placeholder:text-gray-500 focus:border-red focus-visible:ring-1 focus-visible:ring-red" /></label>}
            </div>
            {loading && <p role="status" className="text-xs text-gray-400">Refreshing academic data…</p>}
            {activeTab === "Overview" && <div className="space-y-8">
                <section aria-label="Academic summary" className="grid grid-cols-2 gap-x-6 gap-y-6 border-b border-white/10 pb-7 sm:grid-cols-4">{[["Attendance", attendance.length], ["Classes", classes.length], ["Courses", courses.length], ["Circulars", circulars.length]].map(([label, value]) => <div key={label}><p className="text-2xl font-semibold text-white">{value}</p><p className="mt-1 text-xs text-gray-400">{label}</p></div>)}</section>
                <ProfilePanel profile={profile} />
            </div>}
            {activeTab === "Attendance" && <AttendanceView items={attendance} query={query} />}
            {activeTab === "Timetable" && <TimetableView classes={classes} query={query} />}
            {activeTab === "Courses" && <CourseGrid courses={courses} query={query} />}
            {activeTab === "Marks" && <MarksView items={marks} query={query} />}
            {activeTab === "Calendar" && <CalendarView events={dayOrders} holidays={holidays} />}
            {activeTab === "Circulars" && <CircularsView items={circulars} query={query} />}
        </>}
        <footer className="border-t border-white/10 pt-4 text-xs text-gray-500">Data from Edutech SRM</footer>
    </div>;
}
