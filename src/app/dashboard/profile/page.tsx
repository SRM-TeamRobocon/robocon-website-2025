"use client";

import { useEffect, useState } from "react";
import toast from "react-hot-toast";
import { UserCircle } from "lucide-react";
import ContentEditForm from "@/components/admin/ContentEditForm";
import { CONTENT_RESOURCES } from "@/lib/content-resources";

const PROFILE_FIELDS = CONTENT_RESOURCES.members.fields.filter(
    (f) => f.name !== "is_active" && f.name !== "display_order"
);

interface Candidate {
    id: string;
    name: string;
    role: string;
    domain: string | null;
}

type Mode = "loading" | "not-ready" | "claimed" | "picking" | "claiming" | "creating";

export default function ProfilePage() {
    const [mode, setMode] = useState<Mode>("loading");
    const [profile, setProfile] = useState<Record<string, any> | null>(null);
    const [candidates, setCandidates] = useState<Candidate[]>([]);
    const [selected, setSelected] = useState<Candidate | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const load = () => {
        setMode("loading");
        fetch("/api/profile")
            .then(async (res) => {
                const data = await res.json();
                if (res.ok && data.success && data.claimed) {
                    setProfile(data.data);
                    setMode("claimed");
                } else if (res.ok && data.success && !data.claimed) {
                    setCandidates(data.candidates || []);
                    setMode("picking");
                } else {
                    setMode("not-ready");
                }
            })
            .catch(() => setMode("not-ready"));
    };

    useEffect(load, []);

    const handleSubmit = async (payload: Record<string, any>, extra: Record<string, any> = {}) => {
        setSubmitting(true);
        try {
            const res = await fetch("/api/profile", {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ payload, ...extra }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                toast.success("Profile updated");
                setProfile(data.data);
                setMode("claimed");
            } else {
                toast.error(data.error || "Could not update profile");
            }
        } catch {
            toast.error("An unexpected error occurred");
        } finally {
            setSubmitting(false);
        }
    };

    if (mode === "loading") return <div className="text-gray-500 text-sm">Loading...</div>;

    if (mode === "not-ready") {
        return (
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center text-gray-400 text-sm">
                Your profile isn't set up yet — check back once your account has been approved.
            </div>
        );
    }

    const header = (
        <div>
            <h1 className="text-3xl font-black text-white tracking-tight flex items-center gap-3">
                <UserCircle className="w-7 h-7 text-red" />
                My Profile
            </h1>
            <p className="mt-2 text-gray-400 text-sm">Changes here go live immediately on the public Team page.</p>
        </div>
    );

    if (mode === "picking") {
        return (
            <div className="space-y-6 max-w-xl">
                {header}
                <p className="text-sm text-gray-400">
                    We don't have this login linked to a Team page entry yet. Is one of these you?
                </p>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl overflow-hidden">
                    {candidates.length === 0 ? (
                        <div className="p-6 text-center text-gray-500 text-sm">No unclaimed entries found.</div>
                    ) : (
                        <ul className="divide-y divide-white/5">
                            {candidates.map((c) => (
                                <li key={c.id} className="flex items-center justify-between px-5 py-3">
                                    <span className="text-white text-sm">
                                        {c.name} <span className="text-gray-500">— {c.role}</span>
                                    </span>
                                    <button
                                        onClick={() => {
                                            setSelected(c);
                                            setMode("claiming");
                                        }}
                                        className="rounded-lg bg-white/10 px-3 py-1.5 text-xs font-semibold text-white hover:bg-white/20 transition"
                                    >
                                        That's me
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
                <button
                    onClick={() => setMode("creating")}
                    className="rounded-xl px-4 py-3 text-sm font-semibold text-white bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 transition-all"
                >
                    None of these are me — create a new entry
                </button>
            </div>
        );
    }

    if (mode === "claiming" && selected) {
        return (
            <div className="space-y-6 max-w-xl">
                {header}
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6">
                    <ContentEditForm
                        resource="members"
                        fields={PROFILE_FIELDS}
                        initialValues={selected}
                        submitLabel="Save"
                        submitting={submitting}
                        onSubmit={(payload) => handleSubmit(payload, { claimRowId: selected.id })}
                    />
                </div>
            </div>
        );
    }

    if (mode === "creating") {
        return (
            <div className="space-y-6 max-w-xl">
                {header}
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6">
                    <ContentEditForm
                        resource="members"
                        fields={PROFILE_FIELDS}
                        submitLabel="Create Profile"
                        submitting={submitting}
                        onSubmit={(payload) => handleSubmit(payload, { createNew: true })}
                    />
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 max-w-xl">
            {header}
            <div className="rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-6">
                <ContentEditForm
                    resource="members"
                    fields={PROFILE_FIELDS}
                    initialValues={profile ?? {}}
                    submitLabel="Save Changes"
                    submitting={submitting}
                    onSubmit={(payload) => handleSubmit(payload)}
                />
            </div>
        </div>
    );
}
