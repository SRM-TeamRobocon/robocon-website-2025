"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Package, ClipboardList, BarChart3, Layers, History, Plus } from "lucide-react";
import { BAZAAR_NAME } from "@/lib/bazaar/config";
import { BazaarUser } from "@/lib/bazaar/types";

interface BazaarNavProps {
  onOpenAddItem?: () => void;
  onOpenTakeComponent?: () => void;
}

export function BazaarNav({ onOpenAddItem, onOpenTakeComponent }: BazaarNavProps) {
  const pathname = usePathname();
  const [user, setUser] = useState<BazaarUser | null>(null);

  useEffect(() => {
    fetch("/api/bazaar/me")
      .then((res) => res.json())
      .then((data) => {
        if (data.user) setUser(data.user);
      })
      .catch(() => {});
  }, []);

  const isStaff = user?.role === "lead" || user?.role === "viewer";

  const memberTabs = [
    { label: "Browse", href: "/dashboard/bazaar", icon: Package, exact: true },
    { label: "My Requests", href: "/dashboard/bazaar/my-requests", icon: ClipboardList },
  ];

  const manageTabs = [
    { label: "Overview", href: "/dashboard/bazaar/manage", icon: BarChart3, exact: true },
    { label: "Manage Inventory", href: "/dashboard/bazaar/manage/inventory", icon: Layers },
    { label: "Requests Queue", href: "/dashboard/bazaar/manage/requests", icon: ClipboardList },
    { label: "Activity Log", href: "/dashboard/bazaar/manage/activity", icon: History },
  ];

  const isTabActive = (href: string, exact?: boolean) => {
    if (exact) return pathname === href;
    return pathname === href || pathname.startsWith(href + "/");
  };

  return (
    <div className="mb-6 space-y-4">
      {/* Title & Action Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 bg-red inline-block" />
            <h1 className="text-2xl font-bold text-white tracking-tight uppercase font-Aldrich">
              {BAZAAR_NAME}
            </h1>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            Robocon lab inventory, borrowing, and component tracking system
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
          {onOpenTakeComponent ? (
            <button
              onClick={onOpenTakeComponent}
              className="inline-flex items-center gap-1.5 bg-red hover:bg-red/80 text-white font-bold px-4 py-2 text-xs uppercase tracking-wider transition-colors shadow-lg shadow-red/20"
            >
              <ClipboardList className="w-4 h-4" />
              Take / Borrow Component
            </button>
          ) : (
            <Link
              href="/dashboard/bazaar?action=take"
              className="inline-flex items-center gap-1.5 bg-red hover:bg-red/80 text-white font-bold px-4 py-2 text-xs uppercase tracking-wider transition-colors shadow-lg shadow-red/20"
            >
              <ClipboardList className="w-4 h-4" />
              Take / Borrow Component
            </Link>
          )}

          {onOpenAddItem && (
            <button
              onClick={onOpenAddItem}
              className="inline-flex items-center gap-1.5 border border-white/20 hover:border-white/40 bg-neutral-900 hover:bg-neutral-800 text-white font-bold px-3.5 py-2 text-xs uppercase tracking-wider transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Item
            </button>
          )}
        </div>
      </div>

      {/* Tabs navigation */}
      <div className="flex flex-wrap items-center gap-1 border-b border-white/10 pb-2">
        {memberTabs.map((tab) => {
          const active = isTabActive(tab.href, tab.exact);
          const Icon = tab.icon;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                active
                  ? "bg-white/10 text-white border-b-2 border-red"
                  : "text-gray-400 hover:text-white hover:bg-white/5"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
            </Link>
          );
        })}

        {isStaff && (
          <>
            <div className="h-4 w-px bg-white/20 mx-2 hidden sm:block" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-gray-500 mr-1 hidden sm:inline-block">
              Staff:
            </span>
            {manageTabs.map((tab) => {
              const active = isTabActive(tab.href, tab.exact);
              const Icon = tab.icon;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`inline-flex items-center gap-2 px-3 py-1.5 text-xs font-bold uppercase tracking-wider transition-colors ${
                    active
                      ? "bg-white/10 text-white border-b-2 border-red"
                      : "text-gray-400 hover:text-white hover:bg-white/5"
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </Link>
              );
            })}
          </>
        )}
      </div>
    </div>
  );
}
