"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { FilePlus2, ArrowLeft } from "lucide-react";
import ContentEditForm from "@/components/admin/ContentEditForm";
import AdminGalleryManager from "@/components/admin/AdminGalleryManager";
import { CONTENT_RESOURCES, type ContentResource } from "@/lib/content-resources";
import { useRequireRole } from "@/hooks/use-require-role";
import { Thumb, findImageField } from "@/components/ContentImageFields";

const PROPOSABLE: { key: ContentResource; label: string }[] = [
    { key: "projects", label: "Projects" },
    { key: "achievements", label: "Achievements" },
    { key: "events", label: "Events" },
    { key: "gallery", label: "Gallery" },
];

type Row = Record<string, any>;

export default function ProposeContentPage() {
    const ready = useRequireRole(["member"]);
    const [resource, setResource] = useState<ContentResource>("projects");
    const [rows, setRows] = useState<Row[]>([]);
    const [loading, setLoading] = useState(true);
    const [editing, setEditing] = useState<Row | null | "new">(null);
    const [submitting, setSubmitting] = useState(false);

    useEffect(() => {
        if (resource === "gallery") return;

        setLoading(true);
        setEditing(null);
        fetch(`/api/content/${resource}`)
            .then((res) => res.json())
            .then((data) => setRows(data.data || []))
            .finally(() => setLoading(false));
    }, [resource]);

    const config = CONTENT_RESOURCES[resource];
    const imageField = findImageField(config);

    const handleSubmit = async (payload: Row) => {
        setSubmitting(true);
        try {
            const body =
                editing === "new"
                    ? { resource, action: "create", payload }
                    : { resource, action: "update", recordId: editing!.id, payload };

            const res = await fetch("/api/member/content-edits", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success("Proposal submitted for approval");
                setEditing(null);
            } else {
                toast.error(data.error || "Could not submit proposal");
            }
        } catch {
            toast.error("An unexpected error occurred");
        } finally {
            setSubmitting(false);
        }
    };

    if (!ready) return null;

    const tabs = (
        <div className="flex flex-wrap gap-2">
            {PROPOSABLE.map((r) => (
                <button
                    key={r.key}
                    onClick={() => setResource(r.key)}
                    className={`px-4 py-2 text-sm font-semibold transition ${
                        resource === r.key ? "bg-red/15 text-white ring-1 ring-inset ring-red/40" : "text-gray-400 hover:bg-white/5"
                    }`}
                >
                    {r.label}
                </button>
            ))}
        </div>
    );

    if (resource === "gallery") {
        return (
            <div className="space-y-6">
                {tabs}
                <AdminGalleryManager role="member" />
            </div>
        );
    }

    if (editing !== null) {
        return (
            <div className="space-y-6 max-w-xl">
                <button
                    onClick={() => setEditing(null)}
                    className="inline-flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition"
                >
                    <ArrowLeft className="w-4 h-4" /> Back
                </button>
                <h1 className="text-2xl font-bold text-white">
                    {editing === "new" ? `Propose New ${config.label}` : `Propose Edit — ${editing[config.primaryField]}`}
                </h1>
                <div
                    className="border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6"
                    style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
                >
                    <ContentEditForm
                        fields={config.fields}
                        initialValues={editing === "new" ? {} : editing}
                        submitLabel="Submit for Approval"
                        submitting={submitting}
                        resource={resource}
                        onSubmit={handleSubmit}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                    <FilePlus2 className="w-7 h-7 text-red" />
                    Propose Content
                </h1>
                <p className="mt-2 text-gray-400 text-sm max-w-xl">
                    Suggest a new project, achievement, event, or gallery photo — or edit an existing one. A lead
                    reviews every proposal before it goes live.
                </p>
            </div>

            {tabs}

            <button
                onClick={() => setEditing("new")}
                className="group relative overflow-hidden px-8 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-500 shadow-lg shadow-blue-500/20 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-blue-500/40 active:translate-y-0 active:scale-[0.97]"
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
                    + Propose New {config.label}
                </span>
            </button>

            <div
                className="border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden"
                style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
            >
                {loading ? (
                    <div className="p-8 text-center text-gray-500 text-sm">Loading...</div>
                ) : rows.length === 0 ? (
                    <div className="p-8 text-center text-gray-500 text-sm">No {config.pluralLabel.toLowerCase()} yet.</div>
                ) : (
                    <ul className="divide-y divide-white/5">
                        {rows.map((row) => (
                            <li key={row.id} className="flex items-center justify-between gap-3 px-5 py-3">
                                <div className="flex min-w-0 items-center gap-3">
                                    {imageField && <Thumb src={row[imageField.name]} alt={row[config.primaryField] || "preview"} />}
                                    <span className="truncate text-white text-sm font-medium">
                                        {row[config.primaryField] || "Untitled"}
                                    </span>
                                </div>
                                <button
                                    onClick={() => setEditing(row)}
                                    className="shrink-0 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition"
                                >
                                    Propose Edit
                                </button>
                            </li>
                        ))}
                    </ul>
                )}
            </div>
        </div>
    );
}
