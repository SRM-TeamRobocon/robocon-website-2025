import { formatDate } from "@/lib/utils";
import type { BlogBlock, BlogVisibility } from "@/lib/blog";

interface BlogRendererProps {
    title: string;
    coverImageUrl?: string | null;
    authorName: string;
    publishedAt?: string | null;
    visibility?: BlogVisibility;
    blocks: BlogBlock[];
}

export default function BlogRenderer({ title, coverImageUrl, authorName, publishedAt, visibility, blocks }: BlogRendererProps) {
    return (
        <article className="mx-auto w-full max-w-2xl min-w-0">
            {coverImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={coverImageUrl} alt={title} className="mb-6 aspect-video w-full rounded-2xl border border-white/10 object-cover" />
            )}

            <div className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-gray-400">
                <span className="break-words">{authorName}</span>
                {publishedAt && (
                    <>
                        <span aria-hidden="true">·</span>
                        <span>{formatDate(publishedAt)}</span>
                    </>
                )}
                {visibility === "private" && (
                    <span className="rounded-full bg-amber-500/15 px-2.5 py-0.5 text-xs font-semibold text-amber-400 ring-1 ring-inset ring-amber-500/30">
                        Members only
                    </span>
                )}
            </div>

            <h1 className="mb-8 break-words text-2xl font-black text-white sm:text-3xl md:text-4xl">{title}</h1>

            <div className="space-y-5">
                {blocks.length === 0 && <p className="text-sm italic text-gray-500">Nothing here yet.</p>}
                {blocks.map((block, index) => {
                    if (block.type === "heading") {
                        return (
                            <h2 key={index} className="mt-8 break-words text-lg font-bold text-white sm:text-xl">
                                {block.text}
                            </h2>
                        );
                    }
                    if (block.type === "paragraph") {
                        return (
                            <p key={index} className="whitespace-pre-wrap break-words leading-relaxed text-gray-300 [overflow-wrap:anywhere]">
                                {block.text}
                            </p>
                        );
                    }
                    if (block.type === "image") {
                        return (
                            <figure key={index}>
                                {/* eslint-disable-next-line @next/next/no-img-element */}
                                <img
                                    src={block.url}
                                    alt={block.caption || ""}
                                    className="mx-auto max-h-[32rem] w-full rounded-xl border border-white/10 bg-black/20 object-contain"
                                />
                                {block.caption && <figcaption className="mt-2 break-words text-center text-xs text-gray-500">{block.caption}</figcaption>}
                            </figure>
                        );
                    }
                    return null;
                })}
            </div>
        </article>
    );
}
