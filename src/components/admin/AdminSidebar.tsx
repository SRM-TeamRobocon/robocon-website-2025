"use client";

import React from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
    LayoutDashboard,
    Globe2,
    Box,
    Cpu,
    QrCode,
    ChevronsLeft,
    ChevronsRight,
    X,
    Sparkles,
} from "lucide-react";

export type NavItem = {
    label: string;
    href: string;
    icon: React.ElementType;
    exact?: boolean;
};

export const ADMIN_NAV_ITEMS: NavItem[] = [
    { label: "Overview", href: "/admin/dashboard", icon: LayoutDashboard, exact: true },
    { label: "Website Content", href: "/admin/dashboard/content", icon: Globe2 },
    { label: "Solidworks", href: "/admin/dashboard/solidworks", icon: Box },
    { label: "Altium", href: "/admin/dashboard/altium", icon: Cpu },
    { label: "Scanner", href: "/admin/scanner", icon: QrCode },
];

interface AdminSidebarProps {
    collapsed: boolean;
    onToggleCollapse: () => void;
    mobileOpen: boolean;
    onCloseMobile: () => void;
}

function isActive(pathname: string, item: NavItem) {
    if (item.exact) return pathname === item.href;
    return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export default function AdminSidebar({ collapsed, onToggleCollapse, mobileOpen, onCloseMobile }: AdminSidebarProps) {
    const pathname = usePathname();

    return (
        <>
            {/* Mobile backdrop */}
            {mobileOpen && (
                <div
                    className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
                    onClick={onCloseMobile}
                    aria-hidden="true"
                />
            )}

            <motion.aside
                initial={false}
                animate={{ width: collapsed ? 84 : 264 }}
                transition={{ duration: 0.25, ease: "easeInOut" }}
                className={[
                    "fixed inset-y-0 left-0 z-50 flex flex-col",
                    "border-r border-white/10 bg-black/95 backdrop-blur-xl",
                    "transition-transform duration-300 lg:translate-x-0",
                    "lg:sticky lg:top-0 lg:h-screen lg:z-30",
                    mobileOpen ? "translate-x-0" : "-translate-x-full",
                ].join(" ")}
            >
                {/* Brand row */}
                <div className="flex items-center justify-between gap-2 px-4 h-16 border-b border-white/10 shrink-0">
                    <Link href="/admin/dashboard" className="flex items-center gap-3 min-w-0" onClick={onCloseMobile}>
                        <Image src="/LOGO.png" alt="Logo" width={32} height={32} unoptimized className="rounded shrink-0" />
                        {!collapsed && (
                            <span className="text-white font-bold text-sm tracking-wide truncate">
                                ROBOCON HUB
                            </span>
                        )}
                    </Link>
                    <button
                        onClick={onCloseMobile}
                        className="lg:hidden text-gray-400 hover:text-white transition-colors"
                        aria-label="Close menu"
                    >
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Nav */}
                <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
                    {ADMIN_NAV_ITEMS.map((item) => {
                        const active = isActive(pathname, item);
                        const Icon = item.icon;
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onClick={onCloseMobile}
                                title={collapsed ? item.label : undefined}
                                className={[
                                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
                                    collapsed ? "justify-center" : "",
                                    active
                                        ? "bg-red/15 text-white ring-1 ring-inset ring-red/40"
                                        : "text-gray-400 hover:text-white hover:bg-white/5",
                                ].join(" ")}
                            >
                                {active && (
                                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-[3px] rounded-full bg-red" />
                                )}
                                <Icon className={`w-[18px] h-[18px] shrink-0 ${active ? "text-red" : ""}`} />
                                {!collapsed && <span className="truncate">{item.label}</span>}
                            </Link>
                        );
                    })}
                </nav>

                {/* Future members teaser */}
                {!collapsed && (
                    <div className="mx-3 mb-3 rounded-xl border border-white/10 bg-white/[0.03] p-3">
                        <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-red">
                            <Sparkles className="w-3.5 h-3.5" />
                            More coming
                        </div>
                        <p className="mt-1 text-[11px] leading-relaxed text-gray-500">
                            This hub is being built out for every Robocon member, domain by domain.
                        </p>
                    </div>
                )}

                {/* Collapse toggle (desktop only) */}
                <div className="hidden lg:flex border-t border-white/10 p-3">
                    <button
                        onClick={onToggleCollapse}
                        className="flex w-full items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                    >
                        {collapsed ? <ChevronsRight className="w-4 h-4" /> : <><ChevronsLeft className="w-4 h-4" /> Collapse</>}
                    </button>
                </div>
            </motion.aside>
        </>
    );
}
