"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { useRequireRole } from "@/hooks/use-require-role";
import BlogRenderer from "@/components/blog/BlogRenderer";
import type { BlogBlock, BlogVisibility } from "@/lib/blog";

interface BlogDetail {
    title: string;
    cover_image_url: string | null;
    content: BlogBlock[];
    visibility: BlogVisibility;
    author_name: string;
    published_at: string | null;
}

export default function DashboardBlogDetailPage() {
    const ready = useRequireRole(["member", "lead", "admin"]);
    const params = useParams<{ slug: string }>();
    const router = useRouter();
    const [blog, setBlog] = useState<BlogDetail | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!ready) return;
        fetch(`/api/dashboard/blogs/${params.slug}`)
            .then((res) => res.json())
            .then((data) => {
                if (data.success) setBlog(data.data);
                else router.replace("/dashboard/blogs");
            })
            .finally(() => setLoading(false));
    }, [ready, params.slug, router]);

    if (!ready || loading) return null;
    if (!blog) return null;

    return (
        <div className="space-y-6">
            <Link href="/dashboard/blogs" className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition">
                <ArrowLeft className="w-4 h-4" /> Back to Blog
            </Link>
            <BlogRenderer
                title={blog.title}
                coverImageUrl={blog.cover_image_url}
                authorName={blog.author_name}
                publishedAt={blog.published_at}
                visibility={blog.visibility}
                blocks={blog.content}
            />
        </div>
    );
}
