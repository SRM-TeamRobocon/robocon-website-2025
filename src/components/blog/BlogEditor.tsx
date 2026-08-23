"use client";

import { useState } from "react";
import { Heading, Pilcrow, ImageIcon, Trash2, ArrowUp, ArrowDown, Upload, Eye } from "lucide-react";
import { uploadImageFile } from "@/components/ContentImageFields";
import BlogRenderer from "@/components/blog/BlogRenderer";
import type { BlogBlock, BlogVisibility } from "@/lib/blog";

export interface BlogDraft {
    title: string;
    coverImageUrl: string | null;
    visibility: BlogVisibility;
    content: BlogBlock[];
}

interface BlogEditorProps {
    authorName: string;
    submitting: boolean;
    submitLabel?: string;
    initialDraft?: BlogDraft;
    onSubmit: (draft: BlogDraft) => void;
}

function emptyBlockFor(type: BlogBlock["type"]): BlogBlock {
    if (type === "heading") return { type: "heading", text: "" };
    if (type === "paragraph") return { type: "paragraph", text: "" };
    return { type: "image", url: "", caption: "" };
}

export default function BlogEditor({ authorName, submitting, submitLabel = "Submit for Approval", initialDraft, onSubmit }: BlogEditorProps) {
    const [title, setTitle] = useState(initialDraft?.title ?? "");
    const [coverImageUrl, setCoverImageUrl] = useState<string | null>(initialDraft?.coverImageUrl ?? null);
    const [coverUploading, setCoverUploading] = useState(false);
    const [visibility, setVisibility] = useState<BlogVisibility>(initialDraft?.visibility ?? "public");
    const [blocks, setBlocks] = useState<BlogBlock[]>(initialDraft?.content?.length ? initialDraft.content : [{ type: "paragraph", text: "" }]);
    const [uploadingBlock, setUploadingBlock] = useState<number | null>(null);

    const updateBlock = (index: number, next: BlogBlock) => {
        setBlocks((prev) => prev.map((b, i) => (i === index ? next : b)));
    };

    const removeBlock = (index: number) => {
        setBlocks((prev) => prev.filter((_, i) => i !== index));
    };

    const moveBlock = (index: number, direction: -1 | 1) => {
        setBlocks((prev) => {
            const next = [...prev];
            const target = index + direction;
            if (target < 0 || target >= next.length) return prev;
            [next[index], next[target]] = [next[target], next[index]];
            return next;
        });
    };

    const addBlock = (type: BlogBlock["type"]) => {
        setBlocks((prev) => [...prev, emptyBlockFor(type)]);
    };

    const handleCoverUpload = async (file: File) => {
        setCoverUploading(true);
        try {
            const url = await uploadImageFile(file, { bucket: "blog-images", folder: "covers" });
            setCoverImageUrl(url);
        } catch {
            // uploadImageFile throws on non-ok response; nothing to recover, user can retry.
        } finally {
            setCoverUploading(false);
        }
    };

    const handleBlockImageUpload = async (index: number, file: File) => {
        setUploadingBlock(index);
        try {
            const url = await uploadImageFile(file, { bucket: "blog-images", folder: "content" });
            const current = blocks[index];
            if (current.type === "image") updateBlock(index, { ...current, url });
        } catch {
            // ignore — user can retry the upload
        } finally {
            setUploadingBlock(null);
        }
    };

    const canSubmit = title.trim().length > 0 && blocks.some((b) => (b.type === "image" ? b.url.trim() : b.text.trim()));

    return (
        <div className="grid gap-8 lg:grid-cols-2 lg:items-start">
            <div className="min-w-0 space-y-6">
                <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-gray-500">Title</label>
                    <input
                        type="text"
                        value={title}
                        onChange={(e) => setTitle(e.target.value)}
                        placeholder="Give your post a title"
                        className="w-full border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-red"
                    />
                </div>

                <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-gray-500">Cover image</label>
                    <div className="flex items-start gap-3">
                        {coverImageUrl && (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={coverImageUrl} alt="Cover" className="h-16 w-24 shrink-0 border border-white/10 object-cover" />
                        )}
                        <label className="flex w-fit cursor-pointer items-center gap-2 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20">
                            <Upload size={14} />
                            {coverUploading ? "Uploading..." : coverImageUrl ? "Replace cover" : "Upload cover"}
                            <input
                                type="file"
                                accept="image/*"
                                className="hidden"
                                disabled={coverUploading}
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) handleCoverUpload(file);
                                    e.target.value = "";
                                }}
                            />
                        </label>
                    </div>
                </div>

                <div>
                    <label className="mb-1.5 block text-xs font-bold uppercase tracking-widest text-gray-500">Visibility</label>
                    <div className="flex flex-wrap gap-2">
                        {(["public", "private"] as const).map((v) => (
                            <button
                                key={v}
                                type="button"
                                onClick={() => setVisibility(v)}
                                className={`flex-1 min-w-[9rem] px-3 py-2 text-left text-sm font-semibold transition ${
                                    visibility === v ? "bg-red/15 text-white ring-1 ring-inset ring-red/40" : "text-gray-400 hover:bg-white/5"
                                }`}
                            >
                                <span className="block capitalize">{v}</span>
                                <span className="block text-[11px] font-normal text-gray-500">
                                    {v === "public" ? "Anyone on the site" : "Robocon members only"}
                                </span>
                            </button>
                        ))}
                    </div>
                </div>

                <div className="space-y-3">
                    <label className="block text-xs font-bold uppercase tracking-widest text-gray-500">Content</label>

                    {blocks.map((block, index) => (
                        <div
                            key={index}
                            className="bg-white/10 p-px"
                            style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
                        >
                            <div
                                className="h-full w-full bg-white/[0.03] p-3"
                                style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
                            >
                            <div className="mb-2 flex items-center justify-between">
                                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-500 capitalize">
                                    {block.type === "heading" && <Heading size={12} />}
                                    {block.type === "paragraph" && <Pilcrow size={12} />}
                                    {block.type === "image" && <ImageIcon size={12} />}
                                    {block.type}
                                </span>
                                <div className="flex items-center gap-1">
                                    <button type="button" onClick={() => moveBlock(index, -1)} disabled={index === 0} className="p-1 text-gray-500 hover:text-white disabled:opacity-30">
                                        <ArrowUp size={14} />
                                    </button>
                                    <button type="button" onClick={() => moveBlock(index, 1)} disabled={index === blocks.length - 1} className="p-1 text-gray-500 hover:text-white disabled:opacity-30">
                                        <ArrowDown size={14} />
                                    </button>
                                    <button type="button" onClick={() => removeBlock(index)} className="p-1 text-gray-500 hover:text-red">
                                        <Trash2 size={14} />
                                    </button>
                                </div>
                            </div>

                            {block.type === "heading" && (
                                <input
                                    type="text"
                                    value={block.text}
                                    onChange={(e) => updateBlock(index, { type: "heading", text: e.target.value })}
                                    placeholder="Section heading"
                                    className="w-full border border-white/10 bg-white/5 px-3 py-2 text-sm font-bold text-white outline-none transition focus:border-red"
                                />
                            )}

                            {block.type === "paragraph" && (
                                <textarea
                                    value={block.text}
                                    onChange={(e) => updateBlock(index, { type: "paragraph", text: e.target.value })}
                                    placeholder="Write a paragraph..."
                                    rows={4}
                                    className="w-full resize-y border border-white/10 bg-white/5 px-3 py-2 text-sm text-white outline-none transition focus:border-red"
                                />
                            )}

                            {block.type === "image" && (
                                <div className="space-y-2">
                                    <div className="flex items-start gap-3">
                                        {block.url && (
                                            // eslint-disable-next-line @next/next/no-img-element
                                            <img src={block.url} alt="" className="h-16 w-24 shrink-0 border border-white/10 object-cover" />
                                        )}
                                        <label className="flex w-fit cursor-pointer items-center gap-2 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20">
                                            <Upload size={14} />
                                            {uploadingBlock === index ? "Uploading..." : block.url ? "Replace image" : "Add image"}
                                            <input
                                                type="file"
                                                accept="image/*"
                                                className="hidden"
                                                disabled={uploadingBlock === index}
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) handleBlockImageUpload(index, file);
                                                    e.target.value = "";
                                                }}
                                            />
                                        </label>
                                    </div>
                                    <input
                                        type="text"
                                        value={block.caption || ""}
                                        onChange={(e) => updateBlock(index, { ...block, caption: e.target.value })}
                                        placeholder="Caption (optional)"
                                        className="w-full border border-white/10 bg-white/5 px-3 py-2 text-xs text-white outline-none transition focus:border-red"
                                    />
                                </div>
                            )}
                            </div>
                        </div>
                    ))}

                    <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => addBlock("heading")} className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition">
                            <Heading size={14} /> Add Heading
                        </button>
                        <button type="button" onClick={() => addBlock("paragraph")} className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition">
                            <Pilcrow size={14} /> Add Paragraph
                        </button>
                        <button type="button" onClick={() => addBlock("image")} className="inline-flex items-center gap-1.5 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition">
                            <ImageIcon size={14} /> Add Image
                        </button>
                    </div>
                </div>

                <button
                    type="button"
                    disabled={!canSubmit || submitting}
                    onClick={() => onSubmit({ title: title.trim(), coverImageUrl, visibility, content: blocks })}
                    className="group relative w-full overflow-hidden bg-gradient-to-r from-blue-600 to-blue-500 px-8 py-3 text-sm font-semibold text-white transition-all duration-200 hover:from-blue-500 hover:to-blue-400 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-red/40 active:translate-y-0 active:scale-[0.97] disabled:opacity-50"
                    style={{ clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)" }}
                >
                    <span
                        className="absolute inset-0 -translate-x-full transition-transform duration-200 ease-out group-hover:translate-x-0"
                        style={{
                            clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)",
                            backgroundColor: "#D4AF37",
                        }}
                    />
                    <span className="relative z-10 transition-colors duration-200 group-hover:text-black">
                        {submitting ? "Submitting..." : submitLabel}
                    </span>
                </button>
            </div>

            <div className="min-w-0 lg:sticky lg:top-8 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto">
                <div className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-gray-500">
                    <Eye size={14} /> Live Preview
                </div>
                <div className="bg-white/10 p-px" style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}>
                    <div
                        className="h-full w-full bg-white/[0.03] p-4 sm:p-6"
                        style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
                    >
                        <BlogRenderer
                            title={title || "Untitled post"}
                            coverImageUrl={coverImageUrl}
                            authorName={authorName}
                            visibility={visibility}
                            blocks={blocks}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
}
