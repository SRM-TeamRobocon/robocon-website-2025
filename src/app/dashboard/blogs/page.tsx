"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { Newspaper, ListChecks, PenSquare, ArrowLeft, Pencil, Trash2, Eye } from "lucide-react";
import { useRequireRole } from "@/hooks/use-require-role";
import BlogCard from "@/components/blog/BlogCard";
import { Thumb } from "@/components/ContentImageFields";
import { getBlogExcerpt, type BlogBlock, type BlogVisibility, type BlogStatus } from "@/lib/blog";

interface FeedBlog {
    id: string;
    title: string;
    slug: string;
    cover_image_url: string | null;
    content: BlogBlock[];
    visibility: BlogVisibility;
    author_name: string;
    published_at: string | null;
}

interface MyBlog {
    id: string;
    title: string;
    slug: string;
    cover_image_url: string | null;
    content: BlogBlock[];
    visibility: BlogVisibility;
    status: BlogStatus;
    review_note: string | null;
    created_at: string;
}

const STATUS_STYLES: Record<BlogStatus, string> = {
    pending: "bg-amber-500/15 text-amber-400 ring-amber-500/30",
    approved: "bg-emerald-500/15 text-emerald-400 ring-emerald-500/30",
    rejected: "bg-red-500/15 text-red-400 ring-red-500/30",
};

function FeedTab({ viewerRole }: { viewerRole: string | null }) {
    const [rows, setRows] = useState<FeedBlog[]>([]);
    const [loading, setLoading] = useState(true);
    const canEditAny = viewerRole === "lead" || viewerRole === "admin";

    useEffect(() => {
        fetch("/api/dashboard/blogs")
            .then((res) => res.json())
            .then((data) => setRows(data.data || []))
            .finally(() => setLoading(false));
    }, []);

    if (loading) {
        return (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {[0, 1, 2].map((i) => (
                    <div
                        key={i}
                        className="bg-white/10 p-px"
                        style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
                    >
                        <div
                            className="h-full w-full bg-white/[0.03]"
                            style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
                        >
                            <div className="aspect-video w-full animate-pulse bg-white/5" />
                            <div className="space-y-2 p-5">
                                <div className="h-4 w-3/4 animate-pulse bg-white/5" />
                                <div className="h-3 w-full animate-pulse bg-white/5" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>
        );
    }

    if (rows.length === 0) {
        return (
            <div className="bg-white/10 p-px" style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}>
                <div
                    className="h-full w-full bg-white/[0.03] p-10 text-center"
                    style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
                >
                    <Newspaper className="mx-auto mb-3 h-8 w-8 text-gray-700" />
                    <p className="text-sm text-gray-400">No blogs published yet.</p>
                    <Link href="/dashboard/blogs/new" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-red hover:underline">
                        <PenSquare className="h-4 w-4" /> Write the first one
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {rows.map((row) => (
                <BlogCard
                    key={row.id}
                    href={`/dashboard/blogs/${row.slug}`}
                    title={row.title}
                    excerpt={getBlogExcerpt(row.content)}
                    coverImageUrl={row.cover_image_url}
                    authorName={row.author_name}
                    publishedAt={row.published_at}
                    visibility={row.visibility}
                    editHref={canEditAny ? `/dashboard/blogs/edit/${row.id}` : undefined}
                />
            ))}
        </div>
    );
}

function MineTab() {
    const [rows, setRows] = useState<MyBlog[]>([]);
    const [loading, setLoading] = useState(true);
    const [busyId, setBusyId] = useState<string | null>(null);

    const load = useCallback(() => {
        setLoading(true);
        fetch("/api/member/blogs")
            .then((res) => res.json())
            .then((data) => setRows(data.data || []))
            .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const remove = async (row: MyBlog) => {
        if (!confirm(`Delete "${row.title}"? This cannot be undone.`)) return;
        setBusyId(row.id);
        try {
            const res = await fetch(`/api/member/blogs?id=${row.id}`, { method: "DELETE" });
            const data = await res.json();
            if (res.ok && data.success) {
                setRows((prev) => prev.filter((r) => r.id !== row.id));
                toast.success("Blog deleted");
            } else {
                toast.error(data.error || "Could not delete blog");
            }
        } catch {
            toast.error("An unexpected error occurred");
        } finally {
            setBusyId(null);
        }
    };

    if (loading) return <div className="p-8 text-center text-sm text-gray-500">Loading...</div>;

    if (rows.length === 0) {
        return (
            <div className="bg-white/10 p-px" style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}>
                <div
                    className="h-full w-full bg-white/[0.03] p-10 text-center"
                    style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
                >
                    <PenSquare className="mx-auto mb-3 h-8 w-8 text-gray-700" />
                    <p className="text-sm text-gray-400">You haven&apos;t written any blogs yet.</p>
                    <Link href="/dashboard/blogs/new" className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-red hover:underline">
                        <PenSquare className="h-4 w-4" /> Write your first blog
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <ul className="space-y-3">
            {rows.map((row) => (
                <div key={row.id} className="bg-white/10 p-px" style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}>
                <li
                    className="h-full w-full bg-white/[0.03] p-4 backdrop-blur-xl"
                    style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
                >
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="flex min-w-0 gap-3">
                            <Thumb src={row.cover_image_url} alt={row.title} size={56} />
                            <div className="min-w-0">
                                <p className="break-words font-semibold text-white">{row.title}</p>
                                <div className="mt-1.5 flex flex-wrap items-center gap-2">
                                    <span
                                        className={`inline-flex items-center px-2.5 py-0.5 text-xs font-semibold capitalize ring-1 ring-inset ${STATUS_STYLES[row.status]}`}
                                    >
                                        {row.status}
                                    </span>
                                    <span className="text-xs capitalize text-gray-500">{row.visibility}</span>
                                    <span className="text-xs text-gray-600">
                                        {new Date(row.created_at).toLocaleDateString()}
                                    </span>
                                </div>
                                {row.review_note && (
                                    <p className="mt-2 break-words text-xs text-gray-400">
                                        <span className="font-semibold text-gray-500">Reviewer note:</span> {row.review_note}
                                    </p>
                                )}
                            </div>
                        </div>

                        <div className="flex shrink-0 flex-wrap items-center gap-2">
                            {row.status === "approved" && (
                                <Link
                                    href={`/dashboard/blogs/${row.slug}`}
                                    className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-white/20"
                                >
                                    <Eye className="h-3.5 w-3.5" /> View
                                </Link>
                            )}
                            <Link
                                href={`/dashboard/blogs/edit/${row.id}`}
                                className="inline-flex items-center gap-1.5 bg-blue-500/15 px-3 py-1.5 text-xs font-semibold text-blue-400 ring-1 ring-inset ring-blue-500/30 transition hover:bg-blue-500/25"
                            >
                                <Pencil className="h-3.5 w-3.5" /> Edit
                            </Link>
                            <button
                                onClick={() => remove(row)}
                                disabled={busyId === row.id}
                                className="inline-flex items-center gap-1.5 bg-red-500/15 px-3 py-1.5 text-xs font-semibold text-red-400 ring-1 ring-inset ring-red-500/30 transition hover:bg-red-500/25 disabled:opacity-50"
                            >
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                            </button>
                        </div>
                    </div>
                </li>
                </div>
            ))}
        </ul>
    );
}

function BlogsPageContent() {
    const ready = useRequireRole(["member", "lead", "admin"]);
    const searchParams = useSearchParams();
    const [tab, setTab] = useState<"feed" | "mine">(searchParams.get("tab") === "mine" ? "mine" : "feed");
    const [viewerRole, setViewerRole] = useState<string | null>(null);

    useEffect(() => {
        if (!ready) return;
        fetch("/api/admin/me")
            .then((res) => res.json())
            .then((data) => data.success && setViewerRole(data.role))
            .catch(() => {});
    }, [ready]);

    if (!ready) return null;

    return (
        <div className="space-y-6">
            <Link
                href="/dashboard"
                className="inline-flex items-center gap-1.5 text-sm text-gray-400 transition hover:text-white"
            >
                <ArrowLeft className="h-4 w-4" /> Back to Dashboard
            </Link>

            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <h1 className="flex items-center gap-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
                        <Newspaper className="h-6 w-6 shrink-0 text-red sm:h-7 sm:w-7" />
                        Blog
                    </h1>
                    <p className="mt-2 max-w-xl text-sm text-gray-400">
                        Stories from the team — public posts and members-only posts, all in one feed.
                    </p>
                </div>
                <Link
                    href="/dashboard/blogs/new"
                    className="group relative inline-flex w-fit shrink-0 items-center gap-1.5 overflow-hidden bg-gradient-to-r from-blue-600 to-blue-500 px-8 py-2.5 text-sm font-semibold text-white shadow-lg shadow-blue-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-500/40 active:translate-y-0 active:scale-[0.97]"
                    style={{ clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)" }}
                >
                    <span
                        className="absolute inset-0 -translate-x-full transition-transform duration-200 ease-out group-hover:translate-x-0"
                        style={{
                            clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)",
                            backgroundColor: "#D4AF37",
                        }}
                    />
                    <span className="relative z-10 inline-flex items-center gap-1.5 transition-colors duration-200 group-hover:text-black">
                        <PenSquare className="h-4 w-4" /> Write Blog
                    </span>
                </Link>
            </div>

            <div className="flex flex-wrap gap-2">
                <button
                    onClick={() => setTab("feed")}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition ${
                        tab === "feed" ? "bg-red/15 text-white ring-1 ring-inset ring-red/40" : "text-gray-400 hover:bg-white/5"
                    }`}
                >
                    <Newspaper className="h-4 w-4" /> Feed
                </button>
                <button
                    onClick={() => setTab("mine")}
                    className={`inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold transition ${
                        tab === "mine" ? "bg-red/15 text-white ring-1 ring-inset ring-red/40" : "text-gray-400 hover:bg-white/5"
                    }`}
                >
                    <ListChecks className="h-4 w-4" /> My Blogs
                </button>
            </div>

            {tab === "feed" ? <FeedTab viewerRole={viewerRole} /> : <MineTab />}
        </div>
    );
}

export default function BlogsPage() {
    return (
        <Suspense fallback={null}>
            <BlogsPageContent />
        </Suspense>
    );
}
