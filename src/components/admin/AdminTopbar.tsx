"use client";

import React from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, LogOut } from "lucide-react";
import { ADMIN_NAV_ITEMS } from "./AdminSidebar";

function pageTitleFor(pathname: string) {
    const match = [...ADMIN_NAV_ITEMS]
        .sort((a, b) => b.href.length - a.href.length)
        .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

    if (match) return match.label;
    if (pathname.startsWith("/admin/dashboard/")) {
        const segment = pathname.split("/").filter(Boolean).pop() || "";
        return segment.charAt(0).toUpperCase() + segment.slice(1);
    }
    return "Dashboard";
}

interface AdminTopbarProps {
    username: string;
    role: string | null;
    onOpenMobile: () => void;
}

export default function AdminTopbar({ username, role, onOpenMobile }: AdminTopbarProps) {
    const pathname = usePathname();
    const router = useRouter();
    const title = pageTitleFor(pathname);
    const initials = username
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase();

    const handleLogout = async () => {
        await fetch("/api/admin/logout", { method: "POST" });
        router.push("/admin/login");
    };

    return (
        <header className="sticky top-0 z-20 border-b border-white/10 bg-black/80 backdrop-blur-xl">
            <div className="flex h-16 items-center justify-between gap-4 px-4 sm:px-6">
                <div className="flex items-center gap-3 min-w-0">
                    <button
                        onClick={onOpenMobile}
                        className="lg:hidden text-gray-300 hover:text-white transition-colors"
                        aria-label="Open menu"
                    >
                        <Menu className="w-5 h-5" />
                    </button>
                    <h1 className="text-lg font-bold text-white truncate">{title}</h1>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                    {role && (
                        <span className="hidden sm:inline-flex px-2.5 py-1 rounded-full bg-red/10 border border-red/30 text-red text-[10px] font-bold uppercase tracking-wider">
                            {role}
                        </span>
                    )}

                    <div className="flex items-center gap-2 rounded-full border border-white/10 bg-white/5 pl-1 pr-3 py-1">
                        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-red to-red-800 text-[11px] font-bold text-white">
                            {initials || "AD"}
                        </span>
                        <span className="hidden sm:block text-xs font-semibold text-gray-200 truncate max-w-[140px]">
                            {username}
                        </span>
                    </div>

                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-1.5 rounded-lg bg-white/5 hover:bg-red-600 border border-white/10 hover:border-red-600 px-3 py-2 text-xs font-bold text-gray-300 hover:text-white transition-all"
                    >
                        <LogOut className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Logout</span>
                    </button>
                </div>
            </div>
        </header>
    );
}
