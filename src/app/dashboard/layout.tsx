"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Toaster } from "react-hot-toast";
import AdminSidebar, { type NavRole } from "@/components/admin/AdminSidebar";
import AdminTopbar from "@/components/admin/AdminTopbar";
import GoogleConnectReminder from "@/components/dashboard/GoogleConnectReminder";
import { displayNameForUsername } from "@/lib/admin-users";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const [displayName, setDisplayName] = useState("Member");
    const [role, setRole] = useState<NavRole | null>(null);
    const [photoUrl, setPhotoUrl] = useState<string | null>(null);
    const [collapsed, setCollapsed] = useState(false);
    const [mobileOpen, setMobileOpen] = useState(false);

    useEffect(() => {
        const stored = window.localStorage.getItem("admin_sidebar_collapsed");
        if (stored === "1") setCollapsed(true);
    }, []);

    useEffect(() => {
        setMobileOpen(false);
    }, [pathname]);

    useEffect(() => {
        const fetchUser = async () => {
            try {
                const res = await fetch("/api/admin/me");
                const data = await res.json();
                if (data.success) {
                    setDisplayName(data.name || displayNameForUsername(data.user));
                    setRole((data.role as NavRole) || null);
                }
            } catch (e) {
                console.error("Failed to fetch user", e);
            }
        };
        fetchUser();

        const fetchPhoto = async () => {
            try {
                const res = await fetch("/api/profile");
                const data = await res.json();
                if (data.success && data.claimed && data.data?.photo_url) {
                    setPhotoUrl(data.data.photo_url);
                }
            } catch (e) {
                console.error("Failed to fetch profile photo", e);
            }
        };
        fetchPhoto();
    }, []);

    const toggleCollapse = () => {
        setCollapsed((prev) => {
            const next = !prev;
            window.localStorage.setItem("admin_sidebar_collapsed", next ? "1" : "0");
            return next;
        });
    };

    return (
        <div className="min-h-screen relative z-10 flex">
            <GoogleConnectReminder />
            <Toaster
                position="top-right"
                toastOptions={{
                    style: {
                        background: "#1f2937",
                        color: "#fff",
                        border: "1px solid #374151",
                    },
                    success: {
                        iconTheme: { primary: "#10b981", secondary: "#fff" },
                    },
                    error: {
                        iconTheme: { primary: "#ef4444", secondary: "#fff" },
                    },
                }}
            />

            <AdminSidebar
                role={role}
                collapsed={collapsed}
                onToggleCollapse={toggleCollapse}
                mobileOpen={mobileOpen}
                onCloseMobile={() => setMobileOpen(false)}
            />

            {/* No overflow-x-hidden here: it would make this a scroll container and
                break the sticky topbar. Overflow is contained by min-w-0 + per-component wrapping. */}
            <div className="flex-1 flex flex-col min-w-0">
                <AdminTopbar
                    username={displayName}
                    role={role}
                    photoUrl={photoUrl}
                    onOpenMobile={() => setMobileOpen(true)}
                />
                <main className="flex-grow w-full max-w-7xl mx-auto min-w-0 p-4 md:p-8">
                    {children}
                </main>
            </div>
        </div>
    );
}
