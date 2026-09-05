"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import { ListChecks, Check, Search, MessageCircle, Download, RefreshCw, ChevronDown } from "lucide-react";
import { useRequireRole } from "@/hooks/use-require-role";

import { RECRUIT_SUBDOMAINS, subDomainLabel, subDomainFullLabel, subDomainSubsystem, type RecruitSubDomain } from "@/lib/recruit-domains";
import { SortableTh, compareBy, nextSortState, type SortState } from "@/components/recruit/SortableTh";
import { buildWhatsAppLink } from "@/lib/whatsapp";
import { phoneSearchTerm } from "@/lib/recruit-validation";
import { ExpandToggleCell, DetailRow, DetailField } from "@/components/recruit/ExpandableRow";
import { GENDERS, genderLabel } from "@/lib/gender";
import { RECRUIT_YEARS } from "@/lib/recruit-year";
import { travelMethodLabel } from "@/lib/travel-method";
import Select from "@/components/ui/select";

type ExamDomain = RecruitSubDomain;

const STATUS_OPTIONS = ["all", "pending", "shortlisted", "not_shortlisted"] as const;

const GENDER_OPTIONS = [
  { value: "all", label: "All Genders" },
  ...GENDERS.map((g) => ({ value: g.key, label: g.label })),
];

const YEAR_OPTIONS = [
  { value: "all", label: "All Years" },
  ...RECRUIT_YEARS.map((y) => ({ value: y.key as string, label: y.label })),
];

type InterviewResult = "selected" | "rejected" | "waitlisted";

const INTERVIEW_RESULT_OPTIONS: { value: InterviewResult; label: string }[] = [
  { value: "selected", label: "Selected" },
  { value: "rejected", label: "Rejected" },
  { value: "waitlisted", label: "Waitlisted" },
];

// "Done" and the three specific outcomes deliberately overlap (Done = Selected OR Rejected
// OR Waitlisted) - this is a union/faceted filter, not a set of mutually-exclusive radio
// options, so checking "Done" and "Selected" together is redundant but not wrong. Kept as
// a multi-select (the only one on the page) specifically so a lead can, say, check
// Selected + Waitlisted together to see everyone still in the running.
type InterviewResultFilterValue = "not_done" | "done" | InterviewResult;

const INTERVIEW_RESULT_FILTER_OPTIONS: { value: InterviewResultFilterValue; label: string }[] = [
  { value: "not_done", label: "Not Done" },
  { value: "done", label: "Done (any)" },
  ...INTERVIEW_RESULT_OPTIONS,
];

interface ShortlistRow {
  id: string;
  recruit_id: string;
  sub_domain: string;
  status: "pending" | "shortlisted" | "not_shortlisted";
  method: string;
  override_reason: string | null;
  overridden_by: string | null;
  overridden_at: string | null;
  computed_at: string | null;
  called_by: string | null;
  called_at: string | null;
  marks: number | null;
  // Presence of a logged interview result IS "interview done" - there's no separate
  // boolean, mirrors how recruit_interview_results itself works (see the shortlist GET
  // route). Null means nobody has interviewed this recruit for this domain yet.
  interview_result: InterviewResult | null;
  interview_notes: string | null;
  interview_decided_at: string | null;
  interview_interviewer: string | null;
  recruit: {
    id: string;
    name: string;
    reg_no: string;
    year: string;
    gender: string | null;
    department: string;
    course: string;
    portfolio_url: string | null;
    phone: string | null;
    is_hosteller: boolean;
    hostel_block: string | null;
    hostel_room: string | null;
    day_scholar_area: string | null;
    travel_method: string | null;
  };
}

type ShortlistSortKey = "name" | "reg_no" | "year" | "domain" | "marks" | "status";

function sortValueFor(row: ShortlistRow, key: ShortlistSortKey): string | number | null {
  switch (key) {
    case "name":
      return row.recruit.name;
    case "reg_no":
      return row.recruit.reg_no;
    // Sorted numerically, not as the "1"/"2" strings the column stores, so the order stays
    // right if a third year is ever added (a plain string sort would put "10" before "2").
    case "year":
      return Number(row.recruit.year);
    case "domain":
      return row.sub_domain;
    // Null (nobody has marked them yet) sorts last in both directions - compareBy handles
    // that - so an unmarked recruit never masquerades as a zero at the top of the list.
    case "marks":
      return row.marks;
    case "status":
      return row.status;
    default:
      return null;
  }
}

// Empty selection = no filter (show everyone) - a multi-select with nothing checked reads
// as "not filtering" rather than "match nothing". Otherwise a row passes if it matches ANY
// checked value (union/OR, not AND) - checking Selected + Waitlisted shows everyone in
// either bucket, not just recruits who are somehow both at once.
function matchesInterviewFilter(row: ShortlistRow, selected: Set<InterviewResultFilterValue>): boolean {
  if (selected.size === 0) return true;
  // Array.from + some(), not for..of over the Set directly - this project's TS target
  // doesn't have downlevel iteration enabled for Set/Map iterators.
  return Array.from(selected).some((value) => {
    if (value === "not_done") return row.interview_result === null;
    if (value === "done") return row.interview_result !== null;
    return value === row.interview_result;
  });
}

// Same quoting rule as the server-side interview-results export (wrap in quotes only when
// the cell contains a comma/quote/newline, double up internal quotes) - kept as a client
// copy rather than a shared import because this export runs entirely off `visibleRows`,
// the exact rows and order already on screen after every filter/sort, including the ones
// (gender, year, interview done/not-done, search) that only ever exist client-side and
// have no server query-param equivalent to re-derive them from.
function csvCell(value: string | number | boolean | null | undefined): string {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

const CSV_HEADER = [
  "Name",
  "Reg No",
  "Year",
  "Gender",
  "Department",
  "Course",
  "Phone",
  "Residence",
  "Hostel Block",
  "Hostel Room",
  "Day Scholar Area",
  "Travel Method",
  "Domain",
  "Marks",
  "Status",
  "Override Reason",
  "Called By",
  "Called At",
  "Interview Result",
  "Interview Notes",
  "Interviewer",
  "Interview Decided At",
];

function shortlistRowToCsv(row: ShortlistRow): (string | number | null)[] {
  const acc = row.recruit;
  return [
    acc.name,
    acc.reg_no,
    acc.year,
    genderLabel(acc.gender) || "",
    acc.department,
    acc.course,
    acc.phone,
    acc.is_hosteller ? "Hosteller" : "Day Scholar",
    acc.is_hosteller ? acc.hostel_block ?? "" : "",
    acc.is_hosteller ? acc.hostel_room ?? "" : "",
    acc.is_hosteller ? "" : acc.day_scholar_area ?? "",
    acc.is_hosteller ? "" : travelMethodLabel(acc.travel_method) || "",
    `${subDomainSubsystem(row.sub_domain)}: ${subDomainLabel(row.sub_domain)}`,
    row.marks,
    row.status === "not_shortlisted" ? "Not Shortlisted" : row.status[0].toUpperCase() + row.status.slice(1),
    row.override_reason,
    row.called_by,
    row.called_at,
    row.interview_result ? row.interview_result[0].toUpperCase() + row.interview_result.slice(1) : "Not done",
    row.interview_notes,
    row.interview_interviewer,
    row.interview_decided_at,
  ];
}

// Picking an option here IS the override - there's no separate Shortlist/Reject button
// pair any more. "Pending" is shown as the placeholder (empty value) rather than a
// selectable option: once a lead picks Shortlisted/Not Shortlisted there is no dropdown
// path back to Pending, matching the PATCH endpoint, which only ever accepts those two.
function StatusSelect({
  row,
  busy,
  onChange,
}: {
  row: ShortlistRow;
  busy: boolean;
  onChange: (row: ShortlistRow, status: "shortlisted" | "not_shortlisted") => void;
}) {
  return (
    <Select
      accent="blue"
      value={row.status === "pending" ? "" : row.status}
      onChange={(v) => onChange(row, v as "shortlisted" | "not_shortlisted")}
      disabled={busy}
      placeholder="Pending"
      className="h-9 w-40 bg-white/5 ring-white/10 py-0 px-3 text-xs"
      options={[
        { value: "shortlisted", label: "Shortlisted" },
        { value: "not_shortlisted", label: "Not Shortlisted" },
      ]}
    />
  );
}

function CalledCheckbox({
  row,
  busy,
  onCall,
}: {
  row: ShortlistRow;
  busy: boolean;
  onCall: (id: string) => void;
}) {
  if (row.called_by) {
    return (
      <div className="flex items-center gap-2">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center bg-emerald-500/20 text-emerald-400 ring-1 ring-inset ring-emerald-500/40">
          <Check className="w-3 h-3" />
        </span>
        <span className="text-xs text-gray-400 whitespace-nowrap">called by {row.called_by}</span>
      </div>
    );
  }

  return (
    <input
      type="checkbox"
      checked={false}
      disabled={busy}
      onChange={() => onCall(row.id)}
      aria-label="Mark as called"
      className="h-4 w-4 border-0 bg-white/10 text-blue-500 ring-1 ring-inset ring-white/20 focus:ring-2 focus:ring-blue-500 disabled:opacity-50 cursor-pointer"
    />
  );
}

// Interview outcome, editable right from the shortlist row. While nothing is logged yet,
// "Not done" is just the placeholder (no such option in the list - nothing to undo). Once
// a result IS logged, "Not done (undo)" appears as a real, selectable fourth option - for
// a rushed/wrong click logged against a recruit who then had to leave before actually being
// interviewed. Picking it is a delete, not a value change, so it's routed to a different
// handler than the other three (see the onChange wiring at the call site).
function InterviewStatusSelect({
  row,
  busy,
  onChange,
}: {
  row: ShortlistRow;
  busy: boolean;
  onChange: (row: ShortlistRow, value: InterviewResult | "not_done") => void;
}) {
  const options: { value: string; label: string }[] = row.interview_result
    ? [...INTERVIEW_RESULT_OPTIONS, { value: "not_done", label: "Not done (undo)" }]
    : INTERVIEW_RESULT_OPTIONS;
  return (
    <Select
      accent="blue"
      value={row.interview_result ?? ""}
      onChange={(v) => onChange(row, v as InterviewResult | "not_done")}
      disabled={busy}
      placeholder="Not done"
      className="h-9 w-36 bg-white/5 ring-white/10 py-0 px-3 text-xs"
      options={options}
    />
  );
}

// The one multi-select control on this page - deliberately not built on top of the shared
// Select component above, since that component's whole model is "exactly one value
// selected" (its trigger renders one label, clicking an option closes the list). A
// checkbox listbox is a different enough interaction that bolting multi-select onto Select
// would risk the other ~10 single-select usages of it elsewhere in the app; easier and
// safer to keep this small and page-local.
function InterviewResultFilterDropdown({
  selected,
  onChange,
}: {
  selected: Set<InterviewResultFilterValue>;
  onChange: (next: Set<InterviewResultFilterValue>) => void;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const toggleValue = (value: InterviewResultFilterValue) => {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value);
    else next.add(value);
    onChange(next);
  };

  const label =
    selected.size === 0
      ? "All Interviews"
      : selected.size === 1
      ? INTERVIEW_RESULT_FILTER_OPTIONS.find((o) => o.value === Array.from(selected)[0])?.label
      : `${selected.size} interview filters`;

  return (
    <div ref={rootRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        className="h-10 w-52 flex items-center justify-between gap-2 border-0 bg-white/5 px-3 text-left text-sm text-white ring-1 ring-inset ring-white/10 outline-none transition-all focus:ring-2 focus:ring-blue-500"
      >
        <span className={`truncate ${selected.size === 0 ? "text-white/40" : ""}`}>{label}</span>
        <ChevronDown className={`w-4 h-4 shrink-0 text-white/40 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <ul
          role="listbox"
          className="absolute z-50 mt-2 w-52 max-h-64 overflow-auto border border-white/10 bg-[#141418] py-1 shadow-2xl"
        >
          {INTERVIEW_RESULT_FILTER_OPTIONS.map((o) => (
            <li key={o.value}>
              <label className="flex cursor-pointer items-center gap-2.5 px-4 py-2 text-sm text-white/80 transition-colors hover:bg-white/10">
                <input
                  type="checkbox"
                  checked={selected.has(o.value)}
                  onChange={() => toggleValue(o.value)}
                  className="h-3.5 w-3.5 shrink-0 border-0 bg-white/10 text-blue-500 ring-1 ring-inset ring-white/20 focus:ring-2 focus:ring-blue-500"
                />
                {o.label}
              </label>
            </li>
          ))}
          {selected.size > 0 && (
            <li className="mt-1 border-t border-white/10 pt-1">
              <button
                type="button"
                onClick={() => onChange(new Set())}
                className="w-full px-4 py-1.5 text-left text-xs text-gray-400 transition-colors hover:text-white"
              >
                Clear
              </button>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}

// Editable "why" text for the two dropdowns above, shown only in the expanded row so the
// main table stays compact. Both fields only make sense once there's something to explain
// (a status override / a logged interview result), so each is gated on that happening
// first rather than accepting free text with nothing to attach it to.
function ReasonField({
  value,
  placeholder,
  disabledReason,
  busy,
  onSave,
}: {
  value: string | null;
  placeholder: string;
  disabledReason: string | null;
  busy: boolean;
  onSave: (text: string) => void;
}) {
  const [text, setText] = useState(value ?? "");

  useEffect(() => {
    setText(value ?? "");
  }, [value]);

  if (disabledReason) {
    return <span className="text-xs text-gray-600">{disabledReason}</span>;
  }

  const dirty = text.trim() !== (value ?? "").trim();

  return (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder={placeholder}
        className="w-56 border-0 bg-white/5 py-1 px-2.5 text-white text-xs ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500"
      />
      <button
        type="button"
        onClick={() => onSave(text.trim())}
        disabled={busy || !dirty}
        className="shrink-0 bg-white/10 px-2.5 py-1 text-xs font-semibold text-gray-300 ring-1 ring-inset ring-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed transition"
      >
        Save
      </button>
    </div>
  );
}

function ExamDomainsTab() {
  const [domain, setDomain] = useState<ExamDomain | "all">("all");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("all");
  const [gender, setGender] = useState("all");
  const [year, setYear] = useState("all");
  const [interviewFilter, setInterviewFilter] = useState<Set<InterviewResultFilterValue>>(new Set());
  const [rows, setRows] = useState<ShortlistRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [callBusyId, setCallBusyId] = useState<string | null>(null);
  const [interviewBusyId, setInterviewBusyId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  // Filtering re-runs on every keystroke since it's just an in-memory array scan, which is
  // cheap even at this module's ~2000-recruit scale - the debounce isn't masking a slow
  // filter, it's avoiding needless re-renders (and the residence-breakdown table
  // recomputing) once per keystroke while someone is still mid-word.
  const [debouncedSearch, setDebouncedSearch] = useState("");
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(t);
  }, [search]);
  const [sort, setSort] = useState<SortState<ShortlistSortKey>>(null);
  // Set after every successful load() - lets a lead judge how stale the view might be
  // (another lead's edits since) without needing to guess, and gives the Refresh button
  // below something to report back once it's done.
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  // ONE date for the whole page, not one per recruit. Interview day is walk-in with no time
  // slots (see the interview dashboard), so there is no per-recruit slot to record - everyone
  // shortlisted gets told the same day. Typing it once here also stops a lead retyping the
  // same string for every recruit they message.
  const [interviewDate, setInterviewDate] = useState("");
  // Per-recruit override, keyed by row id - for the recruit whose slot differs from the
  // shared date above (e.g. one domain's interviews run a different day). Empty for a row
  // means "use the shared date"; it does not mean "no date was set for this recruit".
  const [rowInterviewDates, setRowInterviewDates] = useState<Record<string, string>>({});
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [bulkCallBusy, setBulkCallBusy] = useState(false);
  const [whatsappWorklistOpen, setWhatsappWorklistOpen] = useState(false);
  // Session-only "clicked Send" tracker for the WhatsApp worklist below - there's no
  // server-side signal for "a message was sent" (WhatsApp Web gives no delivery callback),
  // so this is purely a visual aid to help a lead see where they left off in the list, not
  // a source of truth. Resets on reload/navigation by design.
  const [sentWhatsAppIds, setSentWhatsAppIds] = useState<Set<string>>(new Set());

  const toggleExpanded = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (domain !== "all") params.set("domain", domain);
      if (status !== "all") params.set("status", status);
      const res = await fetch(`/api/admin/recruitment/shortlist?${params.toString()}`);
      const data = await res.json();
      if (res.ok && data.success) {
        setRows(data.data as ShortlistRow[]);
        setLastRefreshedAt(new Date());
      } else {
        toast.error(data.error || "Could not load shortlist");
      }
    } catch {
      toast.error("Could not load shortlist");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [domain, status]);

  const visibleRows = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    // Name/reg_no match the raw term; phone matches a digits-only copy of it, because
    // numbers are stored bare and a pasted "+91 98765 43210" has to normalize first.
    // phoneQ is null under 3 digits, so a stray digit in a name search matches no phones.
    // Searchable only - phone stays out of the rendered row.
    const phoneQ = phoneSearchTerm(debouncedSearch);
    const filtered = q
      ? rows.filter(
          (row) =>
            row.recruit.name.toLowerCase().includes(q) ||
            row.recruit.reg_no.toLowerCase().includes(q) ||
            (phoneQ !== null && (row.recruit.phone ?? "").includes(phoneQ))
        )
      : rows;

    // Gender is nullable on recruit_accounts, so a recruit with none on file matches neither
    // "Male" nor "Female" - "All Genders" is the option that keeps them in the list. Applied
    // client-side (unlike domain/status) because the column lives on the joined account.
    const byGender = gender === "all" ? filtered : filtered.filter((row) => row.recruit.gender === gender);

    // Same client-side treatment as gender: `year` lives on the joined account, not on
    // recruit_shortlist_status, so it can't ride the server-side domain/status query.
    const byYear = year === "all" ? byGender : byGender.filter((row) => row.recruit.year === year);

    // Interview done-ness is a row presence check (see ShortlistRow's interview_result
    // comment), joined server-side already - so, like gender/year, this filters the
    // already-fetched rows rather than adding another query param.
    const byInterview = byYear.filter((row) => matchesInterviewFilter(row, interviewFilter));

    if (!sort) return byInterview;
    return [...byInterview].sort((a, b) => compareBy(sortValueFor(a, sort.key), sortValueFor(b, sort.key), sort.direction));
  }, [rows, debouncedSearch, gender, year, interviewFilter, sort]);

  // Hosteller vs Day Scholar, split by gender, over whatever is currently in `visibleRows` -
  // so it moves with every filter on this page (domain, status, gender, year, search), not
  // just some of them. If the Gender pill is narrowed to Male, this naturally collapses to a
  // single populated column, since that's what's actually in view.
  const residenceStats = useMemo(() => {
    const empty = () => ({ hosteller: 0, dayScholar: 0 });
    const buckets = { male: empty(), female: empty(), unspecified: empty() };
    for (const row of visibleRows) {
      const key = row.recruit.gender === "male" ? "male" : row.recruit.gender === "female" ? "female" : "unspecified";
      if (row.recruit.is_hosteller) buckets[key].hosteller += 1;
      else buckets[key].dayScholar += 1;
    }
    return buckets;
  }, [visibleRows]);

  const residenceHasUnspecified =
    residenceStats.unspecified.hosteller + residenceStats.unspecified.dayScholar > 0;
  const residenceGenderCols = (
    [
      { key: "male" as const, label: "Male" },
      { key: "female" as const, label: "Female" },
      ...(residenceHasUnspecified ? [{ key: "unspecified" as const, label: "Unspecified" }] : []),
    ]
  );
  const residenceTotals = {
    hosteller: residenceStats.male.hosteller + residenceStats.female.hosteller + residenceStats.unspecified.hosteller,
    dayScholar: residenceStats.male.dayScholar + residenceStats.female.dayScholar + residenceStats.unspecified.dayScholar,
  };

  // Bulk-action targets, both scoped to `visibleRows` - so, like the residence breakdown,
  // "everyone" always means everyone the current filters are showing, not the full table.
  const uncalledVisibleRows = useMemo(() => visibleRows.filter((r) => !r.called_by), [visibleRows]);
  const whatsappWorklistRows = useMemo(
    () => visibleRows.filter((r) => r.status === "shortlisted" && !r.called_by),
    [visibleRows]
  );

  const handleSort = (key: ShortlistSortKey) => setSort((prev) => nextSortState(prev, key));

  const sendWhatsApp = (row: ShortlistRow) => {
    // Row override wins when set; otherwise fall back to the shared date typed once at the
    // top. Covers the recruit whose slot differs (a domain interviewing on a different day)
    // without forcing every other message to be typed out individually.
    const rowOverride = (rowInterviewDates[row.id] ?? "").trim();
    const when = rowOverride || interviewDate.trim();
    // The date line REPLACES the "shared soon" placeholder rather than sitting beside it, so
    // the message never states a time and promises the time separately in the same breath.
    const schedule = when
      ? `Interview: ${when}`
      : "Further details regarding the interview schedule will be shared soon.";

    // Deliberately flush against column 0. A template literal keeps its source indentation,
    // so indenting these lines to match the surrounding code would put four leading spaces in
    // front of every line the recruit actually receives on WhatsApp.
    const message = `Congratulations! You've been shortlisted for the SRM Team Robocon interview for the ${subDomainFullLabel(
      row.sub_domain
    )}! 

Venue: SRM Team Robocon Lab, 1st Floor, SRM IST Canteen, near HiTech Block, Main Campus
Location: https://maps.app.goo.gl/y6auhbSeuUGh2o2N8

${schedule}

We're excited to meet you and see what you've got! 

All the best! 

- SRM Team Robocon`;

    const url = buildWhatsAppLink(row.recruit.phone ?? "", message);
    if (url) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      toast.error("No valid phone number on file for this recruit");
    }
  };

  // Patches the one row from the PATCH response instead of calling load() - a full
  // reload() re-fetches and re-renders every row in view (and flashes "Loading..." over
  // the whole table) just to reflect a single dropdown pick. The response already carries
  // everything the row needs (status/method/override_reason/overridden_by/overridden_at),
  // so there's nothing a re-fetch would tell us that we don't already have. Same pattern
  // markCalled already used below.
  const decide = async (id: string, newStatus: "shortlisted" | "not_shortlisted", reason: string) => {
    setBusyId(id);
    try {
      const res = await fetch(`/api/admin/recruitment/shortlist/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, override_reason: reason || undefined }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        toast.success("Status saved");
        setRows((prev) =>
          prev.map((row) =>
            row.id === id
              ? {
                  ...row,
                  status: data.data.status,
                  method: data.data.method,
                  override_reason: data.data.override_reason,
                  overridden_by: data.data.overridden_by,
                  overridden_at: data.data.overridden_at,
                }
              : row
          )
        );
      } else {
        toast.error(data.error || "Could not save status");
      }
    } catch {
      toast.error("Could not save status");
    } finally {
      setBusyId(null);
    }
  };

  const markCalled = async (id: string) => {
    setCallBusyId(id);
    try {
      const res = await fetch(`/api/admin/recruitment/shortlist/${id}/call`, { method: "POST" });
      const data = await res.json();
      if (res.ok && data.success) {
        setRows((prev) =>
          prev.map((row) =>
            row.id === id ? { ...row, called_by: data.data.called_by, called_at: data.data.called_at } : row
          )
        );
      } else if (res.status === 409) {
        toast.error("Already marked as called, refreshing");
        load();
      } else {
        toast.error(data.error || "Could not mark as called");
      }
    } catch {
      toast.error("Could not mark as called");
    } finally {
      setCallBusyId(null);
    }
  };

  // Fires one call per uncalled visible row, in parallel, against the same single-row
  // endpoint markCalled uses above - there's no bulk endpoint, and none is needed: each
  // call is already small, idempotent-safe (a 409 just means someone else got there
  // first), and this is a lead-triggered action against, at most, one domain's shortlist,
  // not thousands of rows. Successes are applied locally same as markCalled; any failures
  // (most likely a race with another lead calling the same row) fall back to a full load()
  // so the view can't end up silently wrong about who's been called.
  const bulkMarkCalled = async () => {
    const targets = uncalledVisibleRows;
    if (targets.length === 0) return;
    setBulkCallBusy(true);
    try {
      const results = await Promise.allSettled(
        targets.map(async (row) => {
          const res = await fetch(`/api/admin/recruitment/shortlist/${row.id}/call`, { method: "POST" });
          const data = await res.json();
          if (!res.ok || !data.success) throw new Error(data.error || "Could not mark as called");
          return { id: row.id, called_by: data.data.called_by as string, called_at: data.data.called_at as string };
        })
      );

      const succeeded = results.filter(
        (r): r is PromiseFulfilledResult<{ id: string; called_by: string; called_at: string }> => r.status === "fulfilled"
      );
      if (succeeded.length > 0) {
        const byId = new Map(succeeded.map((r) => [r.value.id, r.value]));
        setRows((prev) =>
          prev.map((row) => {
            const hit = byId.get(row.id);
            return hit ? { ...row, called_by: hit.called_by, called_at: hit.called_at } : row;
          })
        );
      }

      const failedCount = results.length - succeeded.length;
      if (failedCount === 0) {
        toast.success(`Marked ${succeeded.length} as called`);
      } else {
        toast.error(`Marked ${succeeded.length} as called, ${failedCount} could not be saved - refreshing`);
        load();
      }
    } finally {
      setBulkCallBusy(false);
    }
  };

  // Same upsert endpoint the interview panel and results-list "Fix" flow use, minus
  // panel_id - this page is never inside a specific panel, so there's no token to flip to
  // `done` here (see that route's panel_id comment). Existing notes are re-sent alongside a
  // result change so correcting selected -> rejected from the dropdown doesn't blank them.
  //
  // Patches local state rather than calling load() (same reasoning as decide() above). The
  // POST response only echoes {result}, not notes/decided_at/interviewer, so those three
  // are filled in from what we already know/expect rather than re-fetched: notes is exactly
  // what was just sent, decided_at is "now" (accurate - the server sets it the same way),
  // and interviewer is left as-is since we don't have the current user's display name on
  // this page. All three are self-correcting on the next natural load() (a filter change,
  // or the Refresh button), and interviewer/decided_at aren't rendered anywhere on this page
  // today (only in the CSV export), so a stale value between now and that next load is low
  // stakes.
  const setInterviewResult = async (row: ShortlistRow, result: InterviewResult) => {
    setInterviewBusyId(row.id);
    try {
      const res = await fetch(`/api/admin/recruitment/interview-results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recruit_id: row.recruit_id,
          sub_domain: row.sub_domain,
          result,
          notes: row.interview_notes || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.saved) {
        toast.success("Interview result saved");
        setRows((prev) =>
          prev.map((r) =>
            r.id === row.id
              ? { ...r, interview_result: data.result as InterviewResult, interview_decided_at: new Date().toISOString() }
              : r
          )
        );
      } else {
        toast.error(data.error || "Could not save interview result");
      }
    } catch {
      toast.error("Could not save interview result");
    } finally {
      setInterviewBusyId(null);
    }
  };

  // Confirmed, destructive: deletes the logged result outright (not a value change, so it
  // doesn't go through setInterviewResult above). Deliberately doesn't touch the recruit's
  // interview token - see the DELETE route's own comment for why guessing at waiting vs
  // no_show from this page would risk returning someone who's already left to a callable
  // queue.
  const undoInterviewResult = async (row: ShortlistRow) => {
    if (
      !confirm(
        `Undo the logged interview result for ${row.recruit.name}? This deletes it - and any notes - entirely. There's no way back except logging it again.`
      )
    ) {
      return;
    }
    setInterviewBusyId(row.id);
    try {
      const res = await fetch(`/api/admin/recruitment/interview-results`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ recruit_id: row.recruit_id, sub_domain: row.sub_domain }),
      });
      const data = await res.json();
      if (res.ok && data.deleted) {
        toast.success("Interview result undone");
        setRows((prev) =>
          prev.map((r) =>
            r.id === row.id ? { ...r, interview_result: null, interview_notes: null, interview_decided_at: null } : r
          )
        );
      } else {
        toast.error(data.error || "Could not undo the interview result");
      }
    } catch {
      toast.error("Could not undo the interview result");
    } finally {
      setInterviewBusyId(null);
    }
  };

  const saveInterviewNotes = async (row: ShortlistRow, notes: string) => {
    if (!row.interview_result) return;
    setInterviewBusyId(row.id);
    try {
      const res = await fetch(`/api/admin/recruitment/interview-results`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          recruit_id: row.recruit_id,
          sub_domain: row.sub_domain,
          result: row.interview_result,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (res.ok && data.saved) {
        toast.success("Notes saved");
        setRows((prev) =>
          prev.map((r) =>
            r.id === row.id ? { ...r, interview_notes: notes || null, interview_decided_at: new Date().toISOString() } : r
          )
        );
      } else {
        toast.error(data.error || "Could not save notes");
      }
    } catch {
      toast.error("Could not save notes");
    } finally {
      setInterviewBusyId(null);
    }
  };

  // Built from `visibleRows`, not a fresh fetch - that's the one place all of this page's
  // filters (server-side domain/status AND client-side gender/year/interview/search) are
  // already combined and in the same order shown on screen, so the export can't drift from
  // what a lead is actually looking at. No backend route needed.
  const exportCsv = () => {
    if (visibleRows.length === 0) {
      toast.error("No rows match the current filters");
      return;
    }
    const lines = [CSV_HEADER, ...visibleRows.map(shortlistRowToCsv)].map((row) =>
      row.map(csvCell).join(",")
    );
    const csv = lines.join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const nameParts = ["shortlist", domain !== "all" ? domain : "all-domains", status !== "all" ? status : "all-statuses"];
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nameParts.join("-")}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <div className="w-48">
          <Select
            accent="blue"
            value={domain}
            onChange={(v) => setDomain(v as ExamDomain | "all")}
            className="h-10 bg-white/5 ring-white/10 py-0 px-3 text-sm"
            options={[
              { value: "all", label: "All Domains" },
              ...RECRUIT_SUBDOMAINS.map((d) => ({ value: d.key, label: `${d.subsystem}: ${d.label}` })),
            ]}
          />
        </div>
        <div className="w-44">
          <Select
            accent="blue"
            value={status}
            onChange={(v) => setStatus(v as (typeof STATUS_OPTIONS)[number])}
            className="h-10 bg-white/5 ring-white/10 py-0 px-3 text-sm"
            options={STATUS_OPTIONS.map((s) => ({
              value: s,
              label: s === "all" ? "All Statuses" : s === "not_shortlisted" ? "Not Shortlisted" : s[0].toUpperCase() + s.slice(1),
            }))}
          />
        </div>
        <div className="w-40">
          <Select
            accent="blue"
            value={gender}
            onChange={setGender}
            className="h-10 bg-white/5 ring-white/10 py-0 px-3 text-sm"
            options={GENDER_OPTIONS}
          />
        </div>
        <div className="w-36">
          <Select
            accent="blue"
            value={year}
            onChange={setYear}
            className="h-10 bg-white/5 ring-white/10 py-0 px-3 text-sm"
            options={YEAR_OPTIONS}
          />
        </div>
        <InterviewResultFilterDropdown selected={interviewFilter} onChange={setInterviewFilter} />
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name, reg no or phone..."
            className="h-10 border-0 bg-white/5 pl-8 pr-3 text-white text-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500"
          />
        </div>
        <input
          type="text"
          value={interviewDate}
          onChange={(e) => setInterviewDate(e.target.value)}
          placeholder="Interview date/time (optional)"
          title="Default for every WhatsApp message sent from this page. A recruit's own row can override it. Leave blank and the message says the schedule follows separately."
          className="h-10 w-60 border-0 bg-white/5 px-3 text-white text-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500 placeholder:text-gray-500"
        />
        <button
          type="button"
          onClick={load}
          disabled={loading}
          title="Re-fetch this domain/status from the server - picks up status/interview/call changes made by another lead"
          className="h-10 inline-flex items-center gap-1.5 bg-white/5 px-3 text-xs font-semibold text-gray-300 ring-1 ring-inset ring-white/10 transition hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </button>
        {lastRefreshedAt && (
          <span className="h-10 inline-flex items-center text-[11px] text-gray-500 whitespace-nowrap">
            Updated {lastRefreshedAt.toLocaleTimeString()}
          </span>
        )}
        <button
          type="button"
          onClick={exportCsv}
          disabled={loading || visibleRows.length === 0}
          title="Export exactly what's in view - every filter above, applied"
          className="h-10 inline-flex items-center gap-1.5 bg-white/5 px-3 text-xs font-semibold text-gray-300 ring-1 ring-inset ring-white/10 transition hover:bg-white/10 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      {!loading && (
        <div className="flex flex-wrap items-center gap-3 border border-white/10 bg-black px-4 py-3">
          <span className="text-[11px] font-bold uppercase tracking-widest text-gray-500 shrink-0">Bulk Actions</span>
          <button
            type="button"
            onClick={bulkMarkCalled}
            disabled={bulkCallBusy || uncalledVisibleRows.length === 0}
            title="Marks every uncalled recruit currently in view as called, one call per row"
            className="inline-flex items-center gap-1.5 bg-blue-500/15 px-3 py-1.5 text-xs font-semibold text-blue-400 ring-1 ring-inset ring-blue-500/30 transition hover:bg-blue-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Check className={`w-3.5 h-3.5 ${bulkCallBusy ? "animate-pulse" : ""}`} />
            {bulkCallBusy ? "Marking..." : `Mark ${uncalledVisibleRows.length} Called`}
          </button>
          <button
            type="button"
            onClick={() => setWhatsappWorklistOpen((o) => !o)}
            disabled={whatsappWorklistRows.length === 0 && !whatsappWorklistOpen}
            title="Opens a one-click-per-recruit list for everyone shortlisted and not yet called - browsers block auto-opening many WhatsApp tabs at once, so this is the reliable way to send several in a row"
            className="inline-flex items-center gap-1.5 bg-emerald-500/15 px-3 py-1.5 text-xs font-semibold text-emerald-400 ring-1 ring-inset ring-emerald-500/30 transition hover:bg-emerald-500/25 disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <MessageCircle className="w-3.5 h-3.5" />
            {whatsappWorklistOpen ? "Hide" : `WhatsApp Worklist (${whatsappWorklistRows.length})`}
          </button>
        </div>
      )}

      {whatsappWorklistOpen && (
        <div className="border border-white/10 bg-black p-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">
            WhatsApp Worklist
            <span className="ml-2 normal-case font-normal text-gray-600">
              Shortlisted, not yet called, matching the filters above - click Send for each in turn
            </span>
          </h2>
          {whatsappWorklistRows.length === 0 ? (
            <p className="mt-3 text-xs text-gray-500">Nobody currently in view is shortlisted-and-uncalled.</p>
          ) : (
            <ul className="mt-3 divide-y divide-white/5">
              {whatsappWorklistRows.map((row) => {
                const sent = sentWhatsAppIds.has(row.id);
                return (
                  <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-2">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-white">{row.recruit.name}</span>
                      <span className="ml-2 text-xs text-gray-500">{row.recruit.reg_no}</span>
                      <span className="ml-2 text-xs text-gray-500">
                        {subDomainSubsystem(row.sub_domain)}: {subDomainLabel(row.sub_domain)}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        sendWhatsApp(row);
                        setSentWhatsAppIds((prev) => new Set(prev).add(row.id));
                      }}
                      className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold ring-1 ring-inset transition ${
                        sent
                          ? "bg-white/5 text-gray-500 ring-white/10"
                          : "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30 hover:bg-emerald-500/25"
                      }`}
                    >
                      {sent ? <Check className="w-3.5 h-3.5" /> : <MessageCircle className="w-3.5 h-3.5" />}
                      {sent ? "Sent - Send Again" : "Send"}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}

      {!loading && visibleRows.length > 0 && (
        <div className="border border-white/10 bg-black p-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-gray-500">
            Residence Breakdown
            <span className="ml-2 normal-case font-normal text-gray-600">
              ({visibleRows.length} in view, matching the filters above)
            </span>
          </h2>
          <div className="overflow-x-auto mt-3">
            <table className="text-sm">
              <thead>
                <tr className="text-left text-[10px] font-bold uppercase tracking-widest text-gray-500 border-b border-white/10">
                  <th className="pr-8 py-2" />
                  {residenceGenderCols.map((g) => (
                    <th key={g.key} className="px-4 py-2 text-right">
                      {g.label}
                    </th>
                  ))}
                  <th className="pl-4 py-2 text-right">Total</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b border-white/5">
                  <td className="pr-8 py-2 text-gray-300">Hosteller</td>
                  {residenceGenderCols.map((g) => (
                    <td key={g.key} className="px-4 py-2 text-right text-gray-200">
                      {residenceStats[g.key].hosteller}
                    </td>
                  ))}
                  <td className="pl-4 py-2 text-right text-white font-semibold">{residenceTotals.hosteller}</td>
                </tr>
                <tr>
                  <td className="pr-8 py-2 text-gray-300">Day Scholar</td>
                  {residenceGenderCols.map((g) => (
                    <td key={g.key} className="px-4 py-2 text-right text-gray-200">
                      {residenceStats[g.key].dayScholar}
                    </td>
                  ))}
                  <td className="pl-4 py-2 text-right text-white font-semibold">{residenceTotals.dayScholar}</td>
                </tr>
                <tr className="border-t border-white/10">
                  <td className="pr-8 py-2 text-gray-500">Total</td>
                  {residenceGenderCols.map((g) => (
                    <td key={g.key} className="px-4 py-2 text-right text-gray-500">
                      {residenceStats[g.key].hosteller + residenceStats[g.key].dayScholar}
                    </td>
                  ))}
                  <td className="pl-4 py-2 text-right text-gray-400 font-semibold">
                    {residenceTotals.hosteller + residenceTotals.dayScholar}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="border border-white/10 bg-black">
        {loading ? (
          <div className="p-8 text-center text-gray-500 text-sm">Loading...</div>
        ) : visibleRows.length === 0 ? (
          <div className="p-8 text-center text-gray-500 text-sm">No recruits match these filters.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-bold uppercase tracking-widest text-gray-500 border-b border-white/10">
                  <SortableTh label="Name" sortKey="name" sort={sort} onSort={handleSort} />
                  <SortableTh label="Reg No" sortKey="reg_no" sort={sort} onSort={handleSort} />
                  <SortableTh label="Year" sortKey="year" sort={sort} onSort={handleSort} />
                  <SortableTh label="Domain" sortKey="domain" sort={sort} onSort={handleSort} />
                  <SortableTh label="Marks" sortKey="marks" sort={sort} onSort={handleSort} />
                  <SortableTh label="Status" sortKey="status" sort={sort} onSort={handleSort} />
                  <th className="px-5 py-3">Called</th>
                  <th className="px-5 py-3">Interview Status</th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => {
                  const isShortlisted = row.status === "shortlisted";
                  const expanded = expandedIds.has(row.id);
                  return (
                    <Fragment key={row.id}>
                      <tr className="border-b border-white/5 last:border-0">
                        <ExpandToggleCell expanded={expanded} onToggle={() => toggleExpanded(row.id)}>
                          {row.recruit.name}
                        </ExpandToggleCell>
                        <td className="px-5 py-3 text-gray-300">{row.recruit.reg_no}</td>
                        <td className="px-5 py-3 text-gray-300">{row.recruit.year || "-"}</td>
                        <td className="px-5 py-3 text-gray-300">
                          {subDomainLabel(row.sub_domain)}
                          <span className="ml-1.5 text-xs text-gray-500">{subDomainSubsystem(row.sub_domain)}</span>
                        </td>
                        {/* Null means nobody has marked them yet, which is NOT a zero, so the
                            dash keeps that distinction visible next to the status badge. */}
                        <td className="px-5 py-3 text-white font-semibold">{row.marks ?? "-"}</td>
                        <td className="px-5 py-3">
                          <StatusSelect
                            row={row}
                            busy={busyId === row.id}
                            onChange={(r, s) => decide(r.id, s, r.override_reason ?? "")}
                          />
                        </td>
                        <td className="px-5 py-3">
                          <CalledCheckbox row={row} busy={callBusyId === row.id} onCall={markCalled} />
                        </td>
                        <td className="px-5 py-3">
                          <InterviewStatusSelect
                            row={row}
                            busy={interviewBusyId === row.id}
                            onChange={(r, v) => (v === "not_done" ? undoInterviewResult(r) : setInterviewResult(r, v))}
                          />
                        </td>
                      </tr>
                      {expanded && (
                        <DetailRow colSpan={8}>
                          <DetailField
                            label="Method"
                            value={<span className="capitalize">{row.method.replace("_", " ")}</span>}
                          />
                          <DetailField label="Phone" value={row.recruit.phone || "-"} />
                          <DetailField
                            label="Residence"
                            value={
                              row.recruit.is_hosteller ? (
                                <>
                                  <span className="text-white">{row.recruit.hostel_block || "-"}</span>
                                  {row.recruit.hostel_room && (
                                    <span className="text-gray-500"> · {row.recruit.hostel_room}</span>
                                  )}
                                </>
                              ) : (
                                <>
                                  <span className="text-gray-500">
                                    Day Scholar{row.recruit.day_scholar_area ? ` · ${row.recruit.day_scholar_area}` : ""}
                                  </span>
                                  {row.recruit.travel_method && (
                                    <span className="text-gray-500"> · {travelMethodLabel(row.recruit.travel_method)}</span>
                                  )}
                                </>
                              )
                            }
                          />
                          <DetailField
                            label="WhatsApp"
                            value={
                              <div className="flex items-center gap-2">
                                <input
                                  type="text"
                                  value={rowInterviewDates[row.id] ?? ""}
                                  onChange={(e) =>
                                    setRowInterviewDates((prev) => ({ ...prev, [row.id]: e.target.value }))
                                  }
                                  placeholder={interviewDate.trim() ? `Default: ${interviewDate.trim()}` : "Date/time for this recruit"}
                                  title="Overrides the shared date above for this recruit only. Leave blank to use the shared date."
                                  className="w-40 border-0 bg-white/5 py-1 px-2.5 text-white text-xs ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-blue-500 placeholder:text-gray-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => sendWhatsApp(row)}
                                  disabled={!isShortlisted}
                                  title={isShortlisted ? "Send WhatsApp message" : "Only available for shortlisted recruits"}
                                  className={`inline-flex items-center justify-center w-8 h-8 ring-1 ring-inset transition shrink-0 ${
                                    isShortlisted
                                      ? "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30 hover:bg-emerald-500/25"
                                      : "bg-white/5 text-gray-600 ring-white/10 opacity-50 cursor-not-allowed"
                                  }`}
                                >
                                  <MessageCircle className="w-4 h-4" />
                                </button>
                              </div>
                            }
                          />
                          <DetailField
                            label="Status Reason"
                            value={
                              <ReasonField
                                value={row.override_reason}
                                placeholder="Reason (optional)"
                                disabledReason={row.status === "pending" ? "Set a status first" : null}
                                busy={busyId === row.id}
                                onSave={(text) => decide(row.id, row.status as "shortlisted" | "not_shortlisted", text)}
                              />
                            }
                          />
                          <DetailField
                            label="Interview Notes"
                            value={
                              <ReasonField
                                value={row.interview_notes}
                                placeholder="Notes (optional)"
                                disabledReason={row.interview_result === null ? "Set an interview result first" : null}
                                busy={interviewBusyId === row.id}
                                onSave={(text) => saveInterviewNotes(row, text)}
                              />
                            }
                          />
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
    </div>
  );
}

export default function RecruitmentShortlistPage() {
  const ready = useRequireRole(["lead", "admin"]);

  if (!ready) return null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
          <ListChecks className="w-7 h-7 text-red" />
          Shortlist
        </h1>
        <p className="mt-2 text-gray-400 text-sm max-w-xl">
          Review auto-computed shortlist status per domain - edit status and interview outcome directly from the dropdowns below.
        </p>
      </div>

      <ExamDomainsTab />
    </div>
  );
}
