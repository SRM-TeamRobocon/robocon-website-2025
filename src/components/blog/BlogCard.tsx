import Link from "next/link";
import { ImageOff } from "lucide-react";
import { formatDate } from "@/lib/utils";
import type { BlogVisibility } from "@/lib/blog";

interface BlogCardProps {
    href: string;
    title: string;
    excerpt: string;
    coverImageUrl?: string | null;
    authorName: string;
    publishedAt?: string | null;
    visibility?: BlogVisibility;
}

export default function BlogCard({ href, title, excerpt, coverImageUrl, authorName, publishedAt, visibility }: BlogCardProps) {
    return (
        <Link
            href={href}
            className="group block overflow-hidden rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl transition hover:border-white/20 hover:bg-white/[0.05]"
        >
            <div className="flex aspect-video w-full items-center justify-center overflow-hidden bg-white/5">
                {coverImageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                        src={coverImageUrl}
                        alt={title}
                        className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                    />
                ) : (
                    <ImageOff className="h-8 w-8 text-gray-700" />
                )}
            </div>
            <div className="p-5">
                {visibility === "private" && (
                    <span className="mb-2 inline-flex items-center rounded-full bg-amber-500/15 px-2.5 py-0.5 text-[11px] font-semibold text-amber-400 ring-1 ring-inset ring-amber-500/30">
                        Members only
                    </span>
                )}
                <h3 className="line-clamp-2 break-words text-lg font-bold text-white">{title}</h3>
                {excerpt && <p className="mt-2 line-clamp-2 break-words text-sm text-gray-400">{excerpt}</p>}
                <p className="mt-3 truncate text-xs text-gray-500">
                    {authorName}
                    {publishedAt ? ` · ${formatDate(publishedAt)}` : ""}
                </p>
            </div>
        </Link>
    );
}
