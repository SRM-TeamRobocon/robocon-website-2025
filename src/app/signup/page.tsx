"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MEMBER_DOMAINS } from "@/constants/constants";
import AuthNav from "@/components/AuthNav";
import Select from "@/components/ui/select";

export default function MemberSignup() {
    const [form, setForm] = useState({
        name: "",
        email: "",
        domain: "",
        regNo: "",
        department: "",
        course: "",
        phone: "",
        profilePhotoUrl: "",
    });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);
    const [googleSignup, setGoogleSignup] = useState(false);
    const [googleReady, setGoogleReady] = useState(false);
    const [prefillLoading, setPrefillLoading] = useState(false);
    const [recruitmentDetailsFound, setRecruitmentDetailsFound] = useState(false);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const startedWithGoogle = params.get("google") === "1";
        setGoogleSignup(startedWithGoogle);

        const oauthError = params.get("error");
        if (oauthError) setError("Google sign-in could not be completed. Please try again.");
        if (!startedWithGoogle) return;

        setPrefillLoading(true);
        fetch("/api/member/signup/prefill", { cache: "no-store" })
            .then(async (res) => {
                const data = await res.json();
                if (!res.ok || !data.success) {
                    if (res.status === 401) {
                        setError(data.error || "Your Google sign-in expired. Continue with Google again.");
                        return;
                    }
                    setGoogleReady(true);
                    setError(data.error || "Could not load recruitment details. You can still enter them manually.");
                    return;
                }

                setGoogleReady(true);
                setRecruitmentDetailsFound(Boolean(data.found));
                if (data.profile) setForm((prev) => ({ ...prev, ...data.profile }));
            })
            .catch(() => {
                setGoogleReady(true);
                setError("Could not load recruitment details. You can still enter them manually.");
            })
            .finally(() => setPrefillLoading(false));
    }, []);

    const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm((prev) => ({ ...prev, [field]: field === "regNo" ? e.target.value.toUpperCase() : e.target.value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (googleSignup && !googleReady) {
            setError("Continue with Google again to verify your sign-in before registering.");
            return;
        }
        if (!form.profilePhotoUrl) {
            setError("Upload a profile photo before submitting.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/member/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...form, googleSignup }),
            });
            const data = await res.json();

            if (res.ok && data.success) {
                setSubmitted(true);
            } else {
                setError(data.error || "Signup failed.");
            }
        } catch {
            setError("An unexpected error occurred. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const photo = e.target.files?.[0];
        if (!photo) return;

        setError("");
        setLoading(true);
        try {
            const formData = new FormData();
            formData.set("photo", photo);
            const res = await fetch("/api/member/signup/profile-photo", { method: "POST", body: formData });
            const data = await res.json();
            if (!res.ok || !data.profilePhotoUrl) {
                setError(data.error || "Could not upload your profile photo.");
                return;
            }
            setForm((prev) => ({ ...prev, profilePhotoUrl: data.profilePhotoUrl }));
        } catch {
            setError("Could not upload your profile photo. Please try again.");
        } finally {
            setLoading(false);
        }
    };

    if (submitted) {
        return (
            <div className="min-h-[100dvh] flex items-center justify-center relative z-10 p-5">
                <div className="w-full max-w-md relative z-10">
                    <AuthNav />
                    <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 p-8 shadow-2xl text-center">
                        <h2 className="text-2xl font-bold text-white mb-3">Check your inbox</h2>
                        <p className="text-sm text-gray-400">
                            We sent a verification link to <span className="text-white">{form.email}</span>. Click it to
                            confirm your email, then wait for an admin to approve your account before logging in.
                        </p>
                        <p className="text-xs text-gray-500 mt-3">
                            Don&apos;t see it? Check your spam/junk folder too.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-[100dvh] flex items-center justify-center relative z-10 p-5">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#D4AF37]/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red/10 rounded-full blur-[100px]" />
            </div>

            <div className="w-full max-w-lg relative z-10">
                <AuthNav />
                <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 p-8 shadow-2xl">
                    <div className="flex justify-center mb-6">
                        <Image src="/LOGO.png" alt="Robocon Logo" width={120} height={120} className="object-contain" unoptimized />
                    </div>

                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Create Member Account</h2>
                        <p className="mt-2 text-sm text-gray-400">Verify your SRM email, then wait for admin approval.</p>
                    </div>

                    {!googleSignup && (
                        <div className="mb-6 space-y-4">
                            <a
                                href="/api/member/auth/google?flow=signup"
                                className="flex w-full items-center justify-center gap-3 border border-white/15 bg-white px-4 py-3 text-sm font-semibold text-gray-900 transition hover:bg-gray-100"
                            >
                                <GoogleMark /> Continue with Google
                            </a>
                            <p className="text-center text-xs text-gray-500">
                                Use the Google account you used during recruitment. On the next page, we&apos;ll prefill
                                your details if we find them.
                            </p>
                        </div>
                    )}

                    {googleSignup && (
                        <div className="mb-6 border border-white/10 bg-white/5 p-4 text-sm text-gray-300">
                            <p className="font-semibold text-white">Google sign-in connected</p>
                            <p className="mt-1 text-xs text-gray-400">
                                {prefillLoading
                                    ? "Loading your recruitment details…"
                                    : recruitmentDetailsFound
                                      ? "We filled these fields from your recruitment account. Review and edit them before submitting. This account will be connected to your Google sign-in."
                                      : "We couldn’t find a recruitment record for this Google account. Enter your details below and we’ll connect this member account to Google."}
                            </p>
                            {!googleReady && !prefillLoading && (
                                <a href="/api/member/auth/google?flow=signup" className="mt-3 inline-block text-red hover:text-red/80">
                                    Continue with Google again
                                </a>
                            )}
                        </div>
                    )}

                    {googleSignup && <form onSubmit={handleSubmit} className="space-y-5">
                        <Field label="Full Name" id="name" value={form.name} onChange={update("name")} placeholder="Christiano Ronaldo" />
                        <Field
                            label="Email"
                            id="email"
                            type="email"
                            autoComplete="username"
                            value={form.email}
                            onChange={update("email")}
                            placeholder="cr0707@srmist.edu.in"
                        />

                        <div>
                            <label htmlFor="domain" className="block text-sm font-medium leading-6 text-gray-300">
                                Domain
                            </label>
                            <div className="mt-2">
                                <Select
                                    id="domain"
                                    value={form.domain}
                                    onChange={(v) => setForm((prev) => ({ ...prev, domain: v }))}
                                    placeholder="Select your domain"
                                    options={MEMBER_DOMAINS.map((d) => ({ value: d, label: d }))}
                                    className="rounded-none bg-white/5 ring-white/10"
                                />
                            </div>
                        </div>

                        <Field
                            label="Registration Number"
                            id="regNo"
                            value={form.regNo}
                            onChange={update("regNo")}
                            placeholder="RA1234567890000"
                        />
                        <div className="grid grid-cols-2 gap-4">
                            <Field label="Department" id="department" value={form.department} onChange={update("department")} placeholder="CINTEL" />
                            <Field label="Course" id="course" value={form.course} onChange={update("course")} placeholder="B.Tech CSE" />
                        </div>
                        <div>
                            <label htmlFor="profile-photo" className="block text-sm font-medium leading-6 text-gray-300">
                                Profile Photo <span className="text-red">*</span>
                            </label>
                            <p className="mt-1 text-xs text-gray-500">Use a clear JPEG, PNG, or WebP photo. Maximum 5 MB.</p>
                            <div className="mt-2 flex items-center gap-4">
                                {form.profilePhotoUrl && (
                                    // eslint-disable-next-line @next/next/no-img-element
                                    <img
                                        src={form.profilePhotoUrl}
                                        alt="Profile photo preview"
                                        className="h-16 w-16 rounded-full border border-white/10 object-cover"
                                    />
                                )}
                                <input
                                    id="profile-photo"
                                    name="profile-photo"
                                    type="file"
                                    accept="image/jpeg,image/png,image/webp"
                                    onChange={handlePhotoUpload}
                                    disabled={loading || prefillLoading}
                                    className="block w-full text-sm text-gray-400 file:mr-3 file:border-0 file:bg-white/10 file:px-3 file:py-2 file:text-sm file:font-semibold file:text-white hover:file:bg-white/20"
                                />
                            </div>
                            {form.profilePhotoUrl && <p className="mt-2 text-xs text-emerald-400">Profile photo uploaded.</p>}
                        </div>
                        <Field
                            label="Phone"
                            id="phone"
                            type="tel"
                            autoComplete="tel"
                            required={false}
                            value={form.phone}
                            onChange={update("phone")}
                            placeholder="9876543210"
                        />
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 p-4 flex items-center justify-center">
                                <h3 className="text-sm text-red font-bold">{error}</h3>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading || prefillLoading || (googleSignup && !googleReady)}
                            className={`group relative flex w-full items-center justify-center overflow-hidden px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-red/40 active:translate-y-0 active:scale-[0.97] ${
                                loading ? "bg-red/40 cursor-not-allowed" : "bg-red"
                            }`}
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
                                {loading ? "Creating account..." : "Submit for Approval"}
                            </span>
                        </button>

                        <p className="text-center text-sm text-gray-400">
                            Already have an account?{" "}
                            <Link href="/login" className="text-red hover:text-red/80">
                                Log in
                            </Link>
                        </p>
                    </form>}
                </div>
            </div>
        </div>
    );
}

function GoogleMark() {
    return (
        <svg aria-hidden="true" viewBox="0 0 48 48" className="h-5 w-5">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z" />
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.73 7.18l7.64 5.92c4.46-4.12 7.13-10.2 7.13-17.57Z" />
            <path fill="#FBBC05" d="M10.53 28.59A14.5 14.5 0 0 1 9.75 24c0-1.59.27-3.13.75-4.59l-7.98-6.19A23.93 23.93 0 0 0 0 24c0 3.87.93 7.52 2.56 10.78l7.97-6.19Z" />
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.9-5.83l-7.64-5.92c-2.13 1.43-4.86 2.28-8.26 2.28-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z" />
        </svg>
    );
}

function Field({
    label,
    id,
    type = "text",
    value,
    onChange,
    placeholder,
    required = true,
    autoComplete,
}: {
    label: string;
    id: string;
    type?: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    required?: boolean;
    autoComplete?: string;
}) {
    return (
        <div>
            <label htmlFor={id} className="block text-sm font-medium leading-6 text-gray-300">
                {label}
            </label>
            <div className="mt-2 relative">
                <input
                    id={id}
                    name={id}
                    type={type}
                    required={required}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    autoComplete={autoComplete}
                    className="block w-full border-0 bg-white/5 py-3 px-4 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-red/50 sm:text-sm sm:leading-6 transition-all"
                />
            </div>
        </div>
    );
}
