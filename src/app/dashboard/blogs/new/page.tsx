"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { PenSquare, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRequireRole } from "@/hooks/use-require-role";
import { displayNameForUsername } from "@/lib/admin-users";
import BlogEditor, { type BlogDraft } from "@/components/blog/BlogEditor";

export default function NewBlogPage() {
    const ready = useRequireRole(["member", "lead", "admin"]);
    const router = useRouter();
    const [authorName, setAuthorName] = useState("You");
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        fetch("/api/admin/me")
            .then((res) => res.json())
            .then((data) => {
                if (data.success) setAuthorName(data.name || displayNameForUsername(data.user));
            })
            .catch(() => {});
    }, []);

    const handleSubmit = async (draft: BlogDraft) => {
        setSubmitting(true);
        try {
            const res = await fetch("/api/member/blogs", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: draft.title,
                    coverImageUrl: draft.coverImageUrl,
                    visibility: draft.visibility,
                    content: draft.content,
                }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success("Blog submitted for approval");
                router.push("/dashboard/blogs?tab=mine");
            } else {
                toast.error(data.error || "Could not submit blog");
            }
        } catch {
            toast.error("An unexpected error occurred");
        } finally {
            setSubmitting(false);
        }
    };

    if (!ready) return null;

    return (
        <div className="space-y-6">
            <Link href="/dashboard/blogs" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition">
                <ArrowLeft className="w-4 h-4" /> Back to Blog
            </Link>
            <div>
                <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                    <PenSquare className="w-7 h-7 text-red" />
                    Write a Blog
                </h1>
                <p className="mt-2 text-gray-400 text-sm max-w-xl">
                    Build your post block by block and preview it on the right. A lead or admin reviews it before it goes live.
                </p>
            </div>

            <BlogEditor authorName={authorName} submitting={submitting} onSubmit={handleSubmit} />
        </div>
    );
}
