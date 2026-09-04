"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import {
    Mail,
    Search,
    Send,
    CheckSquare,
    Square,
    AlertTriangle,
    Save,
    Trash2,
    Eye,
    FlaskConical,
    History,
    ChevronDown,
    ChevronUp,
    RotateCcw,
    X,
} from "lucide-react";
import { useRoleGate } from "@/hooks/use-require-role";
import { groupBySubsystem, subDomainLabel } from "@/lib/recruit-domains";
import { GENDERS } from "@/lib/gender";
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

interface JobProgress {
    total: number;
    sent: number;
    failed: number;
    pending: number;
}

interface JobFailure {
    email: string;
    error: string | null;
    recruits: { id: string; name: string }[];
}

interface RecentJob {
    id: string;
    subject: string;
    body: string;
    event_at: string | null;
    status: "pending" | "sending" | "done";
    total_recruits: number;
    created_by: string;
    created_at: string;
    progress: JobProgress;
}

interface MailTemplate {
    id: string;
    name: string;
    subject: string;
    body: string;
    created_by: string;
    updated_at: string;
}

interface ShortlistRow {
    sub_domain: string;
    status: "pending" | "shortlisted" | "not_shortlisted";
}

const GENDER_OPTIONS = [
    { value: "", label: "All genders" },
    ...GENDERS.map((g) => ({ value: g.key, label: g.label })),
];

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

const JOB_STATUS_STYLES: Record<string, string> = {
    pending: "bg-gray-500/10 text-gray-400 ring-gray-500/30",
    sending: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    done: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
};

function formatDateTime(iso: string) {
    return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });
}

// Shortlist status is per (recruit, domain) - a recruit with two domains can be
// shortlisted in one and pending in the other, so this renders one badge per applied
// domain rather than a single recruit-level flag.
function ShortlistBadges({ domains, rows }: { domains: string[]; rows: ShortlistRow[] }) {
    if (domains.length === 0) return <span className="text-gray-600">-</span>;
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

function FailureList({ failures }: { failures: JobFailure[] }) {
    return (
        <ul className="space-y-1 text-xs text-gray-500 max-h-40 overflow-y-auto">
            {failures.map((f) => (
                <li key={f.email} className="flex items-start gap-1.5">
                    <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                        {f.recruits.map((r) => r.name).join(", ")} ({f.email}): {f.error || "Send failed"}
                    </span>
                </li>
            ))}
        </ul>
    );
}

function ConfirmSendModal({
    count,
    subject,
    onCancel,
    onConfirm,
}: {
    count: number;
    subject: string;
    onCancel: () => void;
    onConfirm: () => void;
}) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md border border-white/10 bg-black p-6 shadow-2xl">
                <h2 className="flex items-center gap-2 text-lg font-bold text-white">
                    <Send className="h-5 w-5 text-red" />
                    Send this email?
                </h2>
                <p className="mt-3 text-sm leading-relaxed text-gray-300">
                    This sends <span className="text-white font-bold">&ldquo;{subject}&rdquo;</span> to{" "}
                    <span className="text-white font-bold">{count}</span> recruit{count === 1 ? "" : "s"}. This cannot be
                    undone.
                </p>
                <div className="mt-5 flex justify-end gap-2">
                    <button onClick={onCancel} className="px-4 py-2 text-sm text-gray-400 hover:text-white">
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className="bg-red px-5 py-2 text-sm font-semibold text-white hover:brightness-110"
                    >
                        Send
                    </button>
                </div>
            </div>
        </div>
    );
}

function PreviewModal({ html, loading, onClose }: { html: string; loading: boolean; onClose: () => void }) {
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
            <div className="w-full max-w-2xl border border-white/10 bg-black shadow-2xl">
                <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
                    <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-300">
                        <Eye className="h-4 w-4 text-red" /> Preview
                    </h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-white">
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="h-[70vh] bg-white">
                    {loading ? (
                        <div className="flex h-full items-center justify-center text-sm text-gray-500">Rendering...</div>
                    ) : (
                        <iframe title="Email preview" srcDoc={html} className="h-full w-full border-0" sandbox="" />
                    )}
                </div>
            </div>
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
    const [gender, setGender] = useState("");
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("");
    const [shortlistMap, setShortlistMap] = useState<Map<string, ShortlistRow[]>>(new Map());
    const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
    // Range-selection anchor/cursor (shift+click and shift+arrow both extend from anchorId
    // to whichever row is clicked/moved to) - see selectRange below.
    const [anchorId, setAnchorId] = useState<string | null>(null);
    const [cursorId, setCursorId] = useState<string | null>(null);
    const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());

    const [subject, setSubject] = useState("");
    const [messageBody, setMessageBody] = useState("");
    const [eventAt, setEventAt] = useState("");
    const [sending, setSending] = useState(false);

    const [confirmOpen, setConfirmOpen] = useState(false);
    const [activeJob, setActiveJob] = useState<{ id: string; progress: JobProgress } | null>(null);
    const [activeJobFailures, setActiveJobFailures] = useState<JobFailure[] | null>(null);

    const [templates, setTemplates] = useState<MailTemplate[]>([]);
    const [templatesLoading, setTemplatesLoading] = useState(false);
    const [selectedTemplateId, setSelectedTemplateId] = useState("");

    const [previewOpen, setPreviewOpen] = useState(false);
    const [previewHtml, setPreviewHtml] = useState("");
    const [previewLoading, setPreviewLoading] = useState(false);

    const [testEmail, setTestEmail] = useState("");
    const [testSending, setTestSending] = useState(false);

    const [recentJobs, setRecentJobs] = useState<RecentJob[]>([]);
    const [recentLoading, setRecentLoading] = useState(false);
    const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
    const [expandedFailures, setExpandedFailures] = useState<JobFailure[] | null>(null);
    const [expandedLoading, setExpandedLoading] = useState(false);
    const [retryingJobId, setRetryingJobId] = useState<string | null>(null);

    useEffect(() => {
        if (!ready) return;

        const controller = new AbortController();
        const t = setTimeout(() => {
            setLoading(true);
            setError(null);
            const params = new URLSearchParams();
            if (domain) params.set("domain", domain);
            if (year) params.set("year", year);
            // Server-side, like domain/year. gender is nullable on recruit_accounts, so a
            // recruit with none on file is only returned under "All genders" (no param).
            if (gender) params.set("gender", gender);
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
    }, [ready, domain, year, gender, search]);

    // Shortlist status lives in a separate table (recruit_shortlist_status), keyed per
    // recruit+domain - fetched alongside the roster so both the "Shortlist" column and the
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

    const fetchTemplates = () => {
        setTemplatesLoading(true);
        fetch("/api/admin/recruitment/mail-templates")
            .then((res) => res.json())
            .then((data) => {
                if (data.success) setTemplates(data.templates);
            })
            .finally(() => setTemplatesLoading(false));
    };

    const fetchRecentJobs = () => {
        setRecentLoading(true);
        fetch("/api/admin/recruitment/send-mail/jobs")
            .then((res) => res.json())
            .then((data) => {
                if (data.success) setRecentJobs(data.jobs);
            })
            .finally(() => setRecentLoading(false));
    };

    useEffect(() => {
        if (!ready) return;
        fetchTemplates();
        fetchRecentJobs();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [ready]);

    // Status filter is applied client-side against the already-loaded roster, since it's
    // a small extra join rather than another server-side filter param.
    const filteredRecruits = useMemo(() => {
        if (!statusFilter) return recruits;
        return recruits.filter((r) => (shortlistMap.get(r.id) || []).some((row) => row.status === statusFilter));
    }, [recruits, shortlistMap, statusFilter]);

    // A filter change can hide rows that were selected under a previous filter - drop
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

    // Replaces the selection with the contiguous block of currently-visible rows between
    // fromId and toId (inclusive, either order) - the standard shift+click/shift+arrow
    // range-select behaviour, so a lead can select a long run of recruits without clicking
    // every single row.
    const selectRange = (fromId: string, toId: string) => {
        const ids = filteredRecruits.map((r) => r.id);
        const fromIdx = ids.indexOf(fromId);
        const toIdx = ids.indexOf(toId);
        if (fromIdx === -1 || toIdx === -1) return;
        const [lo, hi] = fromIdx < toIdx ? [fromIdx, toIdx] : [toIdx, fromIdx];
        setSelectedIds(new Set(ids.slice(lo, hi + 1)));
    };

    // Plain click toggles just that row and moves the range anchor there. Shift+click
    // extends the range from the last anchor to this row instead.
    const handleRowClick = (id: string, shiftKey: boolean) => {
        if (shiftKey && anchorId) {
            setCursorId(id);
            selectRange(anchorId, id);
        } else {
            toggleOne(id);
            setAnchorId(id);
            setCursorId(id);
        }
    };

    // Shift+ArrowUp/ArrowDown moves the range cursor one row and re-selects the block from
    // the anchor to the new cursor position, mirroring shift+click above. Scoped to the
    // table body via onKeyDown so it never fires while typing in the subject/message/search
    // fields elsewhere on the page.
    const handleTableKeyDown = (e: React.KeyboardEvent<HTMLTableSectionElement>) => {
        if (!e.shiftKey || (e.key !== "ArrowDown" && e.key !== "ArrowUp")) return;
        const ids = filteredRecruits.map((r) => r.id);
        if (ids.length === 0) return;
        e.preventDefault();

        const anchor = anchorId ?? cursorId ?? ids[0];
        const current = cursorId ?? anchor;
        const idx = Math.max(ids.indexOf(current), 0);
        const nextIdx = e.key === "ArrowDown" ? Math.min(idx + 1, ids.length - 1) : Math.max(idx - 1, 0);
        const nextId = ids[nextIdx];

        setAnchorId(anchor);
        setCursorId(nextId);
        selectRange(anchor, nextId);
        rowRefs.current.get(nextId)?.focus();
    };

    const canSend = selectedIds.size > 0 && subject.trim().length > 0 && messageBody.trim().length > 0 && !sending;
    const eventAtIso = eventAt ? new Date(eventAt).toISOString() : null;

    // Repeatedly calls .../process (one BCC chunk per call) until the job reports done,
    // reporting progress after every call via onTick. A page reload mid-loop just leaves the
    // job's recipient rows partway through 'pending' - the next call to this (whether from a
    // fresh send, a manual retry, or reopening this page) picks up exactly where it left off.
    const processLoop = async (jobId: string, onTick: (progress: JobProgress) => void): Promise<JobProgress> => {
        let progress: JobProgress = { total: 0, sent: 0, failed: 0, pending: 0 };
        let done = false;
        while (!done) {
            try {
                const res = await fetch(`/api/admin/recruitment/send-mail/jobs/${jobId}/process`, { method: "POST" });
                const data = await res.json();
                if (!res.ok || !data.success) {
                    toast.error(data.error || "Send failed");
                    break;
                }
                progress = data.progress;
                onTick(progress);
                done = data.done;
            } catch {
                toast.error("Lost connection while sending - reopen this page to resume.");
                break;
            }
        }
        return progress;
    };

    const loadActiveJobFailures = async (jobId: string) => {
        try {
            const res = await fetch(`/api/admin/recruitment/send-mail/jobs/${jobId}`);
            const data = await res.json();
            if (data.success) setActiveJobFailures(data.failures);
        } catch {
            // Best-effort - the aggregate counts already reflect the outcome.
        }
    };

    const confirmSend = async () => {
        setConfirmOpen(false);
        setSending(true);
        setActiveJob(null);
        setActiveJobFailures(null);
        try {
            const res = await fetch("/api/admin/recruitment/send-mail", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    recruit_ids: Array.from(selectedIds),
                    subject: subject.trim(),
                    body: messageBody.trim(),
                    event_at: eventAtIso,
                }),
            });
            const data = await res.json();
            if (!res.ok || !data.success) {
                toast.error(data.error || "Could not start this send");
                return;
            }
            if (data.recruits_with_no_email > 0) {
                toast(`${data.recruits_with_no_email} selected recruit(s) have no email on file and were skipped`, {
                    icon: "⚠️",
                });
            }

            const jobId = data.job_id as string;
            setActiveJob({ id: jobId, progress: { total: data.total_recruits, sent: 0, failed: 0, pending: data.total_recruits } });

            const final = await processLoop(jobId, (progress) => setActiveJob({ id: jobId, progress }));
            if (final.failed > 0) void loadActiveJobFailures(jobId);
            if (final.sent > 0 && final.failed === 0) {
                toast.success(`Sent to ${final.sent} recruit${final.sent === 1 ? "" : "s"}`);
            } else if (final.failed > 0) {
                toast(`Sent to ${final.sent}, ${final.failed} failed`, { icon: "⚠️" });
            }
            fetchRecentJobs();
        } catch {
            toast.error("Could not send mail");
        } finally {
            setSending(false);
        }
    };

    const retryActiveJob = async () => {
        if (!activeJob) return;
        setSending(true);
        try {
            await fetch(`/api/admin/recruitment/send-mail/jobs/${activeJob.id}/retry`, { method: "POST" });
            setActiveJobFailures(null);
            const jobId = activeJob.id;
            const final = await processLoop(jobId, (progress) => setActiveJob({ id: jobId, progress }));
            if (final.failed > 0) void loadActiveJobFailures(jobId);
            fetchRecentJobs();
        } finally {
            setSending(false);
        }
    };

    const loadTemplate = (id: string) => {
        setSelectedTemplateId(id);
        const t = templates.find((tpl) => tpl.id === id);
        if (t) {
            setSubject(t.subject);
            setMessageBody(t.body);
        }
    };

    const saveTemplate = async () => {
        if (!subject.trim() || !messageBody.trim()) {
            toast.error("Write a subject and message first");
            return;
        }
        const name = window.prompt("Template name?");
        if (!name || !name.trim()) return;

        const res = await fetch("/api/admin/recruitment/mail-templates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name.trim(), subject: subject.trim(), body: messageBody.trim() }),
        });
        const data = await res.json();
        if (data.success) {
            toast.success("Template saved");
            fetchTemplates();
            setSelectedTemplateId(data.template.id);
        } else {
            toast.error(data.error || "Could not save template");
        }
    };

    // Turns a previously sent email (fetched from Recent Sends) into a reusable template,
    // without retyping the subject/body by hand.
    const saveJobAsTemplate = async (job: RecentJob, e: React.MouseEvent) => {
        e.stopPropagation();
        const name = window.prompt("Template name?", job.subject);
        if (!name || !name.trim()) return;

        const res = await fetch("/api/admin/recruitment/mail-templates", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: name.trim(), subject: job.subject, body: job.body }),
        });
        const data = await res.json();
        if (data.success) {
            toast.success("Template saved");
            fetchTemplates();
        } else {
            toast.error(data.error || "Could not save template");
        }
    };

    const updateTemplate = async () => {
        if (!selectedTemplateId) return;
        if (!subject.trim() || !messageBody.trim()) {
            toast.error("Write a subject and message first");
            return;
        }
        const current = templates.find((tpl) => tpl.id === selectedTemplateId);
        const res = await fetch(`/api/admin/recruitment/mail-templates/${selectedTemplateId}`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: current?.name, subject: subject.trim(), body: messageBody.trim() }),
        });
        const data = await res.json();
        if (data.success) {
            toast.success("Template updated");
            fetchTemplates();
        } else {
            toast.error(data.error || "Could not update template");
        }
    };

    const deleteTemplate = async () => {
        if (!selectedTemplateId) return;
        if (!window.confirm("Delete this template?")) return;
        const res = await fetch(`/api/admin/recruitment/mail-templates/${selectedTemplateId}`, { method: "DELETE" });
        const data = await res.json();
        if (data.success) {
            toast.success("Template deleted");
            setSelectedTemplateId("");
            fetchTemplates();
        } else {
            toast.error(data.error || "Could not delete template");
        }
    };

    const openPreview = async () => {
        setPreviewOpen(true);
        setPreviewLoading(true);
        try {
            const res = await fetch("/api/admin/recruitment/send-mail/preview", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ subject, body: messageBody, event_at: eventAtIso }),
            });
            const data = await res.json();
            if (data.success) {
                setPreviewHtml(data.html);
            } else {
                toast.error(data.error || "Could not render preview");
                setPreviewOpen(false);
            }
        } catch {
            toast.error("Could not render preview");
            setPreviewOpen(false);
        } finally {
            setPreviewLoading(false);
        }
    };

    const sendTest = async () => {
        if (!testEmail.trim()) {
            toast.error("Enter an email to send the test to");
            return;
        }
        if (!subject.trim() || !messageBody.trim()) {
            toast.error("Write a subject and message first");
            return;
        }
        setTestSending(true);
        try {
            const res = await fetch("/api/admin/recruitment/send-mail/test", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    test_email: testEmail.trim(),
                    subject: subject.trim(),
                    body: messageBody.trim(),
                    event_at: eventAtIso,
                }),
            });
            const data = await res.json();
            if (data.success) toast.success(`Test sent to ${testEmail.trim()}`);
            else toast.error(data.error || "Could not send test email");
        } catch {
            toast.error("Could not send test email");
        } finally {
            setTestSending(false);
        }
    };

    const loadJobDetail = async (jobId: string) => {
        setExpandedLoading(true);
        try {
            const res = await fetch(`/api/admin/recruitment/send-mail/jobs/${jobId}`);
            const data = await res.json();
            if (data.success) setExpandedFailures(data.failures);
        } finally {
            setExpandedLoading(false);
        }
    };

    const toggleExpand = (jobId: string) => {
        if (expandedJobId === jobId) {
            setExpandedJobId(null);
            setExpandedFailures(null);
            return;
        }
        setExpandedJobId(jobId);
        setExpandedFailures(null);
        void loadJobDetail(jobId);
    };

    const retryRecentJob = async (jobId: string) => {
        setRetryingJobId(jobId);
        try {
            await fetch(`/api/admin/recruitment/send-mail/jobs/${jobId}/retry`, { method: "POST" });
            await processLoop(jobId, (progress) => {
                setRecentJobs((prev) =>
                    prev.map((j) => (j.id === jobId ? { ...j, progress, status: progress.pending > 0 ? "sending" : "done" } : j))
                );
            });
            if (expandedJobId === jobId) void loadJobDetail(jobId);
        } finally {
            setRetryingJobId(null);
            fetchRecentJobs();
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
                <div className="flex flex-wrap items-end gap-3">
                    <div className="w-64">
                        <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">
                            Template
                        </label>
                        <Select
                            value={selectedTemplateId}
                            onChange={loadTemplate}
                            className="h-10 bg-white/5 ring-white/10 py-0 px-3 text-sm"
                            options={[
                                { value: "", label: templatesLoading ? "Loading..." : "None" },
                                ...templates.map((t) => ({ value: t.id, label: t.name })),
                            ]}
                        />
                    </div>
                    <button
                        onClick={saveTemplate}
                        className="h-10 inline-flex items-center gap-1.5 px-3 text-xs font-semibold text-gray-300 ring-1 ring-inset ring-white/10 hover:bg-white/5"
                    >
                        <Save className="w-3.5 h-3.5" /> Save as template
                    </button>
                    {selectedTemplateId && (
                        <>
                            <button
                                onClick={updateTemplate}
                                className="h-10 inline-flex items-center gap-1.5 px-3 text-xs font-semibold text-gray-300 ring-1 ring-inset ring-white/10 hover:bg-white/5"
                            >
                                Update template
                            </button>
                            <button
                                onClick={deleteTemplate}
                                className="h-10 inline-flex items-center gap-1.5 px-3 text-xs font-semibold text-red-400 ring-1 ring-inset ring-white/10 hover:bg-white/5"
                            >
                                <Trash2 className="w-3.5 h-3.5" /> Delete
                            </button>
                        </>
                    )}
                </div>

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

                <div className="flex flex-wrap items-end gap-3 pt-2 border-t border-white/5">
                    <div className="flex-1 min-w-[200px]">
                        <label className="block text-xs font-semibold uppercase tracking-widest text-gray-500 mb-1">
                            Send a test to
                        </label>
                        <input
                            type="email"
                            value={testEmail}
                            onChange={(e) => setTestEmail(e.target.value)}
                            placeholder="you@example.com"
                            className="w-full border-0 bg-white/5 py-2 px-3 text-white text-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-red placeholder:text-gray-600"
                        />
                    </div>
                    <button
                        onClick={sendTest}
                        disabled={testSending || !subject.trim() || !messageBody.trim()}
                        className="h-[38px] inline-flex items-center gap-1.5 px-4 text-xs font-semibold text-gray-300 ring-1 ring-inset ring-white/10 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <FlaskConical className="w-3.5 h-3.5" /> {testSending ? "Sending..." : "Send test"}
                    </button>
                    <button
                        onClick={openPreview}
                        disabled={!subject.trim() || !messageBody.trim()}
                        className="h-[38px] inline-flex items-center gap-1.5 px-4 text-xs font-semibold text-gray-300 ring-1 ring-inset ring-white/10 hover:bg-white/5 disabled:opacity-40 disabled:cursor-not-allowed"
                    >
                        <Eye className="w-3.5 h-3.5" /> Preview
                    </button>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/5">
                    <p className="text-sm text-gray-400">
                        <span className="text-white font-bold">{selectedCount}</span> recruit{selectedCount === 1 ? "" : "s"} selected
                    </p>
                    <button
                        onClick={() => setConfirmOpen(true)}
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

                {activeJob && (
                    <div className="bg-white/5 ring-1 ring-inset ring-white/10 p-3 text-sm space-y-2">
                        <div className="flex items-center justify-between gap-3">
                            <p className="text-gray-300">
                                <span className="text-emerald-400 font-bold">{activeJob.progress.sent}</span> sent
                                {activeJob.progress.failed > 0 && (
                                    <>
                                        {" "}
                                        · <span className="text-red-400 font-bold">{activeJob.progress.failed}</span> failed
                                    </>
                                )}{" "}
                                of {activeJob.progress.total}
                            </p>
                            {activeJob.progress.failed > 0 && activeJob.progress.pending === 0 && (
                                <button
                                    onClick={retryActiveJob}
                                    disabled={sending}
                                    className="inline-flex items-center gap-1.5 text-xs font-semibold text-red hover:text-white disabled:opacity-50"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Retry failed
                                </button>
                            )}
                        </div>
                        <div className="h-1.5 w-full bg-white/10 overflow-hidden">
                            <div
                                className="h-full bg-red transition-all duration-300"
                                style={{
                                    width: `${
                                        activeJob.progress.total
                                            ? ((activeJob.progress.sent + activeJob.progress.failed) / activeJob.progress.total) * 100
                                            : 0
                                    }%`,
                                }}
                            />
                        </div>
                        {activeJobFailures && activeJobFailures.length > 0 && <FailureList failures={activeJobFailures} />}
                    </div>
                )}
            </div>

            <div className="border border-white/10 bg-black p-5 space-y-3">
                <div className="flex items-center justify-between">
                    <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-gray-400">
                        <History className="w-4 h-4 text-red" /> Recent Sends
                    </h2>
                    <button onClick={fetchRecentJobs} className="text-xs text-gray-500 hover:text-white">
                        Refresh
                    </button>
                </div>
                {recentLoading ? (
                    <p className="text-sm text-gray-500">Loading...</p>
                ) : recentJobs.length === 0 ? (
                    <p className="text-sm text-gray-500">No sends yet this cycle.</p>
                ) : (
                    <div className="divide-y divide-white/5">
                        {recentJobs.map((job) => (
                            <div key={job.id} className="py-3">
                                <div
                                    role="button"
                                    tabIndex={0}
                                    onClick={() => toggleExpand(job.id)}
                                    onKeyDown={(e) => {
                                        if (e.key === "Enter" || e.key === " ") {
                                            e.preventDefault();
                                            toggleExpand(job.id);
                                        }
                                    }}
                                    className="flex w-full items-center justify-between gap-3 text-left cursor-pointer focus:outline-none"
                                >
                                    <div className="min-w-0 flex-1">
                                        <p className="truncate text-sm text-white font-medium">{job.subject}</p>
                                        <p className="text-xs text-gray-500">
                                            {formatDateTime(job.created_at)} · {job.created_by}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-3 shrink-0">
                                        <span
                                            className={`inline-flex items-center px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${JOB_STATUS_STYLES[job.status]}`}
                                        >
                                            {job.status}
                                        </span>
                                        <span className="text-xs text-gray-400">
                                            <span className="text-emerald-400">{job.progress.sent}</span>
                                            {job.progress.failed > 0 && (
                                                <>
                                                    {" "}
                                                    / <span className="text-red-400">{job.progress.failed}</span>
                                                </>
                                            )}{" "}
                                            / {job.progress.total}
                                        </span>
                                        <button
                                            onClick={(e) => saveJobAsTemplate(job, e)}
                                            title="Save as template"
                                            className="text-gray-500 hover:text-white"
                                        >
                                            <Save className="w-3.5 h-3.5" />
                                        </button>
                                        {expandedJobId === job.id ? (
                                            <ChevronUp className="w-4 h-4 text-gray-500" />
                                        ) : (
                                            <ChevronDown className="w-4 h-4 text-gray-500" />
                                        )}
                                    </div>
                                </div>
                                {expandedJobId === job.id && (
                                    <div className="mt-3 pl-1">
                                        {expandedLoading ? (
                                            <p className="text-xs text-gray-500">Loading failures...</p>
                                        ) : expandedFailures && expandedFailures.length > 0 ? (
                                            <>
                                                <FailureList failures={expandedFailures} />
                                                <button
                                                    onClick={() => retryRecentJob(job.id)}
                                                    disabled={retryingJobId === job.id}
                                                    className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-red hover:text-white disabled:opacity-50"
                                                >
                                                    <RotateCcw className="w-3.5 h-3.5" />
                                                    {retryingJobId === job.id ? "Retrying..." : "Retry failed"}
                                                </button>
                                            </>
                                        ) : (
                                            <p className="text-xs text-gray-500">No failures.</p>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
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
                <div className="w-40">
                    <Select
                        value={gender}
                        onChange={setGender}
                        className="h-10 bg-white/5 ring-white/10 py-0 px-3 text-sm"
                        options={GENDER_OPTIONS}
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
                            <tbody onKeyDown={handleTableKeyDown}>
                                {filteredRecruits.map((r) => {
                                    const checked = selectedIds.has(r.id);
                                    return (
                                        <tr
                                            key={r.id}
                                            ref={(el) => {
                                                if (el) rowRefs.current.set(r.id, el);
                                                else rowRefs.current.delete(r.id);
                                            }}
                                            tabIndex={0}
                                            onClick={(e) => handleRowClick(r.id, e.shiftKey)}
                                            className="border-b border-white/5 last:border-0 cursor-pointer hover:bg-white/[0.03] focus:outline-none focus:bg-white/[0.05] focus:ring-1 focus:ring-inset focus:ring-red/40"
                                        >
                                            <td className="px-5 py-3" onClick={(e) => e.stopPropagation()}>
                                                <button
                                                    onClick={(e) => handleRowClick(r.id, e.shiftKey)}
                                                    className="flex items-center"
                                                >
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

            {confirmOpen && (
                <ConfirmSendModal
                    count={selectedCount}
                    subject={subject.trim()}
                    onCancel={() => setConfirmOpen(false)}
                    onConfirm={confirmSend}
                />
            )}
            {previewOpen && (
                <PreviewModal html={previewHtml} loading={previewLoading} onClose={() => setPreviewOpen(false)} />
            )}
        </div>
    );
}
