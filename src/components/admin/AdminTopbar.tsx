"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useRouter } from "next/navigation";
import { Menu, LogOut, UserCircle } from "lucide-react";
import { ADMIN_NAV_ITEMS } from "./AdminSidebar";

function pageTitleFor(pathname: string) {
    const match = [...ADMIN_NAV_ITEMS]
        .sort((a, b) => b.href.length - a.href.length)
        .find((item) => pathname === item.href || pathname.startsWith(`${item.href}/`));

    if (match) return match.label;
    if (pathname.startsWith("/dashboard/")) {
        const segment = pathname.split("/").filter(Boolean).pop() || "";
        return segment.charAt(0).toUpperCase() + segment.slice(1);
    }
    return "Dashboard";
}

interface AdminTopbarProps {
    username: string;
    role: string | null;
    photoUrl: string | null;
    onOpenMobile: () => void;
}

export default function AdminTopbar({ username, role, photoUrl, onOpenMobile }: AdminTopbarProps) {
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

    const [menuOpen, setMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!menuOpen) return;
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setMenuOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [menuOpen]);

    useEffect(() => {
        setMenuOpen(false);
    }, [pathname]);

    const handleLogout = async () => {
        await fetch("/api/admin/logout", { method: "POST" });
        router.push("/login");
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
                        <span className="hidden sm:inline-flex px-2.5 py-1 bg-red/10 border border-red/30 text-red text-[10px] font-bold uppercase tracking-wider">
                            {role}
                        </span>
                    )}

                    <div className="relative" ref={menuRef}>
                        <button
                            onClick={() => setMenuOpen((v) => !v)}
                            aria-haspopup="menu"
                            aria-expanded={menuOpen}
                            className="flex items-center gap-2 border border-white/10 bg-white/5 hover:bg-white/10 pl-1 pr-3 py-1 transition-colors"
                        >
                            {photoUrl ? (
                                <Image
                                    src={photoUrl}
                                    alt={username}
                                    width={28}
                                    height={28}
                                    unoptimized
                                    className="h-7 w-7 object-cover shrink-0"
                                />
                            ) : (
                                <span className="flex h-7 w-7 items-center justify-center bg-gradient-to-br from-red to-red-800 text-[11px] font-bold text-white shrink-0">
                                    {initials || "AD"}
                                </span>
                            )}
                            <span className="hidden sm:block text-xs font-semibold text-gray-200 truncate max-w-[140px]">
                                {username}
                            </span>
                        </button>

                        {menuOpen && (
                            <div
                                role="menu"
                                className="absolute right-0 top-full mt-2 w-48 border border-white/10 bg-black/95 backdrop-blur-xl shadow-xl overflow-hidden"
                            >
                                <Link
                                    href="/dashboard/profile"
                                    role="menuitem"
                                    onClick={() => setMenuOpen(false)}
                                    className="flex items-center gap-2 px-4 py-3 text-sm font-medium text-gray-200 hover:bg-white/5 hover:text-white transition-colors"
                                >
                                    <UserCircle className="w-4 h-4" />
                                    My Profile
                                </Link>
                            </div>
                        )}
                    </div>

                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-1.5 bg-white/5 hover:bg-red-600 border border-white/10 hover:border-red-600 px-3 py-2 text-xs font-bold text-gray-300 hover:text-white transition-all"
                    >
                        <LogOut className="w-3.5 h-3.5" />
                        <span className="hidden sm:inline">Logout</span>
                    </button>
                </div>
            </div>
        </header>
    );
}
