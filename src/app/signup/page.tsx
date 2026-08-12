"use client";

import React, { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { MEMBER_DOMAINS } from "@/constants/constants";
import PasswordToggle from "@/components/PasswordToggle";
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
        password: "",
        confirmPassword: "",
    });
    const [error, setError] = useState("");
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const update = (field: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm((prev) => ({ ...prev, [field]: e.target.value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        if (form.password !== form.confirmPassword) {
            setError("Passwords do not match.");
            return;
        }

        setLoading(true);
        try {
            const res = await fetch("/api/member/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
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

    if (submitted) {
        return (
            <div className="min-h-screen flex items-center justify-center relative z-10 p-5">
                <div className="w-full max-w-md relative z-10">
                    <AuthNav />
                    <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-3xl p-8 shadow-2xl text-center">
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
        <div className="min-h-screen flex items-center justify-center relative z-10 p-5">
            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[100px]" />
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-[100px]" />
            </div>

            <div className="w-full max-w-lg relative z-10">
                <AuthNav />
                <div className="bg-gray-900/80 backdrop-blur-xl border border-gray-700/50 rounded-3xl p-8 shadow-2xl">
                    <div className="flex justify-center mb-6">
                        <Image src="/LOGO.png" alt="Robocon Logo" width={120} height={120} className="object-contain" unoptimized />
                    </div>

                    <div className="text-center mb-8">
                        <h2 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">Create Member Account</h2>
                        <p className="mt-2 text-sm text-gray-400">Use your @srmist.edu.in email</p>
                    </div>

                    <form onSubmit={handleSubmit} className="space-y-5">
                        <Field label="Full Name" id="name" value={form.name} onChange={update("name")} placeholder="Christiano Ronaldo" />
                        <Field
                            label="Email"
                            id="email"
                            type="email"
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
                                    accent="blue"
                                    value={form.domain}
                                    onChange={(v) => setForm((prev) => ({ ...prev, domain: v }))}
                                    placeholder="Select your domain"
                                    options={MEMBER_DOMAINS.map((d) => ({ value: d, label: d }))}
                                    className="bg-white/5 ring-white/10"
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
                        <Field
                            label="Phone"
                            id="phone"
                            type="tel"
                            required={false}
                            value={form.phone}
                            onChange={update("phone")}
                            placeholder="9876543210"
                        />
                        <Field
                            label="Password"
                            id="password"
                            type="password"
                            value={form.password}
                            onChange={update("password")}
                            placeholder="At least 8 characters"
                        />
                        <Field
                            label="Confirm Password"
                            id="confirmPassword"
                            type="password"
                            value={form.confirmPassword}
                            onChange={update("confirmPassword")}
                            placeholder="Re-enter password"
                        />

                        {error && (
                            <div className="rounded-lg bg-red-500/10 border border-red-500/20 p-4 flex items-center justify-center">
                                <h3 className="text-sm text-red font-bold">{error}</h3>
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className={`flex w-full justify-center rounded-xl px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all ${
                                loading
                                    ? "bg-blue-600/50 cursor-not-allowed"
                                    : "bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-500 hover:to-blue-400 hover:shadow-lg hover:shadow-blue-500/25"
                            }`}
                        >
                            {loading ? "Creating account..." : "Sign Up"}
                        </button>

                        <p className="text-center text-sm text-gray-400">
                            Already have an account?{" "}
                            <Link href="/login" className="text-blue-400 hover:text-blue-300">
                                Log in
                            </Link>
                        </p>
                    </form>
                </div>
            </div>
        </div>
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
}: {
    label: string;
    id: string;
    type?: string;
    value: string;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    placeholder?: string;
    required?: boolean;
}) {
    const [showPassword, setShowPassword] = useState(false);
    const isPassword = type === "password";
    return (
        <div>
            <label htmlFor={id} className="block text-sm font-medium leading-6 text-gray-300">
                {label}
            </label>
            <div className="mt-2 relative">
                <input
                    id={id}
                    name={id}
                    type={isPassword && showPassword ? "text" : type}
                    required={required}
                    value={value}
                    onChange={onChange}
                    placeholder={placeholder}
                    className={`block w-full rounded-xl border-0 bg-white/5 py-3 px-4 text-white shadow-sm ring-1 ring-inset ring-white/10 focus:ring-2 focus:ring-inset focus:ring-blue-500 sm:text-sm sm:leading-6 transition-all ${
                        isPassword ? "pr-11" : ""
                    }`}
                />
                {isPassword && (
                    <PasswordToggle shown={showPassword} onToggle={() => setShowPassword((s) => !s)} />
                )}
            </div>
        </div>
    );
}
