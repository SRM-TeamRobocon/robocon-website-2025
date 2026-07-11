"use client";

import React, { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Toaster } from "react-hot-toast";
import AdminSidebar from "@/components/admin/AdminSidebar";
import AdminTopbar from "@/components/admin/AdminTopbar";
import { displayNameForUsername } from "@/lib/admin-users";

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const [displayName, setDisplayName] = useState("Member");
    const [role, setRole] = useState<string | null>(null);
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
                    setDisplayName(displayNameForUsername(data.user));
                    setRole(data.role || null);
                }
            } catch (e) {
                console.error("Failed to fetch user", e);
            }
        };
        fetchUser();
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
                collapsed={collapsed}
                onToggleCollapse={toggleCollapse}
                mobileOpen={mobileOpen}
                onCloseMobile={() => setMobileOpen(false)}
            />

            <div className="flex-1 flex flex-col min-w-0">
                <AdminTopbar
                    username={displayName}
                    role={role}
                    onOpenMobile={() => setMobileOpen(true)}
                />
                <main className="flex-grow p-4 md:p-8 max-w-7xl w-full mx-auto">
                    {children}
                </main>
            </div>
        </div>
    );
}
