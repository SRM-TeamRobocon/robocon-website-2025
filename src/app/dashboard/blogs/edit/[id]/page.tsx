"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import toast from "react-hot-toast";
import { PenSquare, ArrowLeft } from "lucide-react";
import { useRequireRole } from "@/hooks/use-require-role";
import BlogEditor, { type BlogDraft } from "@/components/blog/BlogEditor";
import type { BlogBlock, BlogVisibility } from "@/lib/blog";

export default function EditBlogPage() {
    const ready = useRequireRole(["member", "lead", "admin"]);
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const [draft, setDraft] = useState<BlogDraft | null>(null);
    const [authorName, setAuthorName] = useState("You");
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (!ready) return;

        fetch(`/api/member/blogs?id=${params.id}`)
            .then((res) => res.json())
            .then((data) => {
                if (!data.success) {
                    toast.error(data.error || "Could not load that blog");
                    router.replace("/dashboard/blogs?tab=mine");
                    return;
                }
                const row = data.data;
                setAuthorName(row.author_name || "You");
                setDraft({
                    title: row.title,
                    coverImageUrl: row.cover_image_url,
                    visibility: row.visibility as BlogVisibility,
                    content: (row.content || []) as BlogBlock[],
                });
            })
            .catch(() => {
                toast.error("An unexpected error occurred");
                router.replace("/dashboard/blogs?tab=mine");
            })
            .finally(() => setLoading(false));
    }, [ready, params.id, router]);

    const handleSubmit = async (next: BlogDraft) => {
        setSubmitting(true);
        try {
            const res = await fetch("/api/member/blogs", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ id: params.id, ...next }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success("Updated — resubmitted for approval");
                router.push("/dashboard/blogs?tab=mine");
            } else {
                toast.error(data.error || "Could not update blog");
            }
        } catch {
            toast.error("An unexpected error occurred");
        } finally {
            setSubmitting(false);
        }
    };

    if (!ready || loading) return null;
    if (!draft) return null;

    return (
        <div className="space-y-6">
            <Link
                href="/dashboard/blogs?tab=mine"
                className="inline-flex items-center gap-1.5 text-sm text-gray-400 transition hover:text-white"
            >
                <ArrowLeft className="h-4 w-4" /> Back to My Blogs
            </Link>

            <div>
                <h1 className="flex items-center gap-3 text-2xl font-black tracking-tight text-white sm:text-3xl">
                    <PenSquare className="h-6 w-6 shrink-0 text-red sm:h-7 sm:w-7" />
                    Edit Blog
                </h1>
                <p className="mt-2 max-w-xl text-sm text-gray-400">
                    Saving changes sends this post back to a lead for approval, so it will leave the live feed until re-approved.
                </p>
            </div>

            <BlogEditor
                authorName={authorName}
                submitting={submitting}
                submitLabel="Save & Resubmit"
                initialDraft={draft}
                onSubmit={handleSubmit}
            />
        </div>
    );
}
