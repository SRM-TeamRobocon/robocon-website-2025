"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import { BookOpen, Upload, Trash2, FileText } from "lucide-react";
import { useRoleGate } from "@/hooks/use-require-role";

type KbDocument = {
    id: string;
    filename: string;
    uploaded_by: string;
    created_at: string;
    chunk_count: number;
};

export default function KnowledgeBasePage() {
    const { ready } = useRoleGate(["lead", "admin"]);
    const [documents, setDocuments] = useState<KbDocument[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const load = useCallback(async () => {
        try {
            const res = await fetch("/api/admin/recruitment/kb/documents");
            const data = await res.json();
            if (res.ok) setDocuments(data.data ?? []);
            else toast.error(data.error || "Could not load documents");
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!ready) return;
        load();
    }, [ready, load]);

    const upload = async (file: File) => {
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append("file", file);
            const res = await fetch("/api/admin/recruitment/kb/documents", { method: "POST", body: formData });
            const data = await res.json();
            if (res.ok) {
                toast.success(data.warning ? data.warning : `Uploaded — ${data.data.chunk_count} chunks`);
                await load();
            } else {
                toast.error(data.error || "Could not upload file");
            }
        } finally {
            setUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };

    const remove = async (doc: KbDocument) => {
        if (!confirm(`Delete "${doc.filename}"? The chatbot will no longer use it.`)) return;
        try {
            const res = await fetch(`/api/admin/recruitment/kb/documents/${doc.id}`, { method: "DELETE" });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success("Deleted");
                await load();
            } else {
                toast.error(data.error || "Could not delete document");
            }
        } catch {
            toast.error("Network error while deleting");
        }
    };

    if (!ready) return null;

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                    <BookOpen className="w-7 h-7 text-red" />
                    Knowledge Base
                </h1>
                <p className="mt-2 text-gray-400 text-sm max-w-xl">
                    Upload .txt files — the recruit dashboard chatbot answers questions using only what's here.
                </p>
            </div>

            <label className="inline-flex items-center gap-2 rounded-xl bg-red/15 px-4 py-2.5 text-sm font-semibold text-red ring-1 ring-inset ring-red/40 transition hover:bg-red/25 cursor-pointer w-fit">
                <Upload className="h-4 w-4" />
                {uploading ? "Uploading..." : "Upload .txt file"}
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".txt,text/plain"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) upload(file);
                    }}
                />
            </label>

            {loading ? (
                <div className="p-8 text-center text-gray-500 text-sm">Loading...</div>
            ) : documents.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-sm text-gray-500">
                    No files uploaded yet.
                </div>
            ) : (
                <div className="space-y-2">
                    {documents.map((doc) => (
                        <div
                            key={doc.id}
                            className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3"
                        >
                            <div className="flex items-center gap-3 min-w-0">
                                <FileText className="h-5 w-5 text-gray-500 shrink-0" />
                                <div className="min-w-0">
                                    <p className="text-sm font-semibold text-white truncate">{doc.filename}</p>
                                    <p className="text-xs text-gray-500">
                                        {doc.chunk_count} chunk{doc.chunk_count === 1 ? "" : "s"} · {doc.uploaded_by} ·{" "}
                                        {new Date(doc.created_at).toLocaleDateString()}
                                        {doc.chunk_count === 0 && (
                                            <span className="text-amber-400"> · failed to embed, delete and retry</span>
                                        )}
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={() => remove(doc)}
                                className="shrink-0 inline-flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-400 ring-1 ring-inset ring-red-500/30 transition hover:bg-red-500/25"
                            >
                                <Trash2 className="h-3.5 w-3.5" /> Delete
                            </button>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
