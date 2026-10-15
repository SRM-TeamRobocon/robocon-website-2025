"use client";

import React, { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Clock,
  CheckCircle,
  Package,
  AlertTriangle,
  ArrowRight,
  TrendingDown,
  Layers,
  FileSpreadsheet,
} from "lucide-react";
import toast from "react-hot-toast";
import { BazaarNav } from "@/components/bazaar/BazaarNav";
import { AddItemModal } from "@/components/bazaar/AddItemModal";
import { RequestActionModal, RequestActionType } from "@/components/bazaar/RequestActionModal";
import { formatDate } from "@/lib/bazaar/dates";
import { BazaarRequest } from "@/lib/bazaar/types";

interface StatsData {
  stats: {
    pending: number;
    awaiting_handover: number;
    issued: number;
    overdue: number;
    low_stock: number;
  };
  needs_attention: {
    oldest_pending: BazaarRequest[];
    top_overdue: (BazaarRequest & { days_overdue: number })[];
  };
}

export default function BazaarManageOverviewPage() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [selectedReq, setSelectedReq] = useState<BazaarRequest | null>(null);
  const [actionType, setActionType] = useState<RequestActionType | null>(null);

  const fetchStats = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bazaar/manage/stats");
      const json = await res.json();
      if (res.ok) {
        setData(json);
      } else {
        toast.error(json.error?.message || "Failed to load management overview");
      }
    } catch {
      toast.error("Failed to load management overview");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  const stats = data?.stats;

  return (
    <div className="space-y-6">
      <BazaarNav onOpenAddItem={() => setIsAddItemOpen(true)} />

      {/* Overview Stat Cards */}
      {loading || !stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-24 bg-black border border-white/10 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
          {/* Pending */}
          <Link
            href="/dashboard/bazaar/manage/requests?status=pending"
            className="bg-black border border-white/10 p-4 hover:border-yellow-500/40 transition-colors group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-yellow-400">
              <span className="text-[10px] font-bold uppercase tracking-wider">Pending</span>
              <Clock className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-white mt-2">{stats.pending}</div>
            <div className="text-[11px] text-gray-500 group-hover:text-yellow-400 flex items-center gap-1 mt-1">
              View queue <ArrowRight className="w-3 h-3" />
            </div>
          </Link>

          {/* Awaiting Handover */}
          <Link
            href="/dashboard/bazaar/manage/requests?status=approved"
            className="bg-black border border-white/10 p-4 hover:border-blue-500/40 transition-colors group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-blue-400">
              <span className="text-[10px] font-bold uppercase tracking-wider">Awaiting Handover</span>
              <CheckCircle className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-white mt-2">{stats.awaiting_handover}</div>
            <div className="text-[11px] text-gray-500 group-hover:text-blue-400 flex items-center gap-1 mt-1">
              Ready to issue <ArrowRight className="w-3 h-3" />
            </div>
          </Link>

          {/* Issued / In Circulation */}
          <Link
            href="/dashboard/bazaar/manage/requests?status=issued"
            className="bg-black border border-white/10 p-4 hover:border-emerald-500/40 transition-colors group flex flex-col justify-between"
          >
            <div className="flex items-center justify-between text-emerald-400">
              <span className="text-[10px] font-bold uppercase tracking-wider">With Members</span>
              <Package className="w-4 h-4" />
            </div>
            <div className="text-2xl font-bold text-white mt-2">{stats.issued}</div>
            <div className="text-[11px] text-gray-500 group-hover:text-emerald-400 flex items-center gap-1 mt-1">
              Active loans <ArrowRight className="w-3 h-3" />
            </div>
          </Link>

          {/* Overdue */}
          <Link
            href="/dashboard/bazaar/manage/requests?overdue=1"
            className={`bg-black border p-4 transition-colors group flex flex-col justify-between ${
              stats.overdue > 0
                ? "border-red/40 bg-red/5 hover:border-red"
                : "border-white/10 hover:border-white/20"
            }`}
          >
            <div className="flex items-center justify-between text-red">
              <span className="text-[10px] font-bold uppercase tracking-wider">Overdue</span>
              <AlertTriangle className="w-4 h-4" />
            </div>
            <div className={`text-2xl font-bold mt-2 ${stats.overdue > 0 ? "text-red" : "text-white"}`}>
              {stats.overdue}
            </div>
            <div className="text-[11px] text-gray-500 group-hover:text-red flex items-center gap-1 mt-1">
              Urgent returns <ArrowRight className="w-3 h-3" />
            </div>
          </Link>

          {/* Low Stock Items */}
          <Link
            href="/dashboard/bazaar/manage/inventory?lowStock=1"
            className="bg-black border border-white/10 p-4 hover:border-white/30 transition-colors group flex flex-col justify-between col-span-2 sm:col-span-1"
          >
            <div className="flex items-center justify-between text-gray-400">
              <span className="text-[10px] font-bold uppercase tracking-wider">Low Stock</span>
              <TrendingDown className="w-4 h-4 text-yellow-400" />
            </div>
            <div className="text-2xl font-bold text-white mt-2">{stats.low_stock}</div>
            <div className="text-[11px] text-gray-500 group-hover:text-white flex items-center gap-1 mt-1">
              Restock needed <ArrowRight className="w-3 h-3" />
            </div>
          </Link>
        </div>
      )}

      {/* Action shortcuts */}
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard/bazaar/manage/inventory"
          className="border border-white/20 hover:border-white/40 text-gray-300 hover:text-white px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition-colors inline-flex items-center gap-2"
        >
          <Layers className="w-3.5 h-3.5" /> Full Inventory Table
        </Link>
        <Link
          href="/dashboard/bazaar/manage/requests"
          className="border border-white/20 hover:border-white/40 text-gray-300 hover:text-white px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition-colors inline-flex items-center gap-2"
        >
          <Clock className="w-3.5 h-3.5" /> Full Requests Queue
        </Link>
        <a
          href="/api/bazaar/manage/export?type=requests"
          className="border border-white/20 hover:border-white/40 text-gray-300 hover:text-white px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition-colors inline-flex items-center gap-2"
        >
          <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> Export CSV
        </a>
      </div>

      {/* Priority Queues: Oldest Pending & Overdue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Oldest Pending */}
        <div className="bg-black border border-white/10 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Needs Approval
              </h3>
              <p className="text-[11px] text-gray-500">Oldest pending component requests</p>
            </div>
            <Link
              href="/dashboard/bazaar/manage/requests?status=pending"
              className="text-xs text-red hover:underline font-semibold"
            >
              View all
            </Link>
          </div>

          {!data || data.needs_attention.oldest_pending.length === 0 ? (
            <p className="text-xs text-gray-500 py-6 text-center">No pending requests right now.</p>
          ) : (
            <div className="space-y-3">
              {data.needs_attention.oldest_pending.map((req) => (
                <div
                  key={req.id}
                  className="p-3 bg-neutral-900 border border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-white">
                      {req.quantity}x {req.item?.name}
                    </div>
                    <div className="text-gray-400">
                      by <strong className="text-gray-200">{req.member_name}</strong> &bull; Taking: {formatDate(req.taking_date)}
                    </div>
                    <div className="text-gray-500 italic line-clamp-1">&ldquo;{req.purpose}&rdquo;</div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => {
                        setSelectedReq(req);
                        setActionType("approve");
                      }}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-3 py-1 text-[11px] uppercase tracking-wider"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => {
                        setSelectedReq(req);
                        setActionType("reject");
                      }}
                      className="border border-red/40 text-red hover:bg-red/10 font-bold px-3 py-1 text-[11px] uppercase tracking-wider"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Top Overdue */}
        <div className="bg-black border border-white/10 p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-white/10 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Overdue Loans
              </h3>
              <p className="text-[11px] text-gray-500">Components past expected return date</p>
            </div>
            <Link
              href="/dashboard/bazaar/manage/requests?overdue=1"
              className="text-xs text-red hover:underline font-semibold"
            >
              View all
            </Link>
          </div>

          {!data || data.needs_attention.top_overdue.length === 0 ? (
            <p className="text-xs text-gray-500 py-6 text-center">No overdue components. Great job!</p>
          ) : (
            <div className="space-y-3">
              {data.needs_attention.top_overdue.map((req) => (
                <div
                  key={req.id}
                  className="p-3 bg-neutral-900 border border-red/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="font-bold text-white">
                      {req.quantity}x {req.item?.name}
                    </div>
                    <div className="text-gray-400">
                      held by <strong className="text-gray-200">{req.member_name}</strong>
                    </div>
                    <div className="text-red font-bold text-[11px]">
                      Due {formatDate(req.expected_return_date)} ({req.days_overdue} days overdue)
                    </div>
                  </div>

                  <div className="shrink-0">
                    <button
                      onClick={() => {
                        setSelectedReq(req);
                        setActionType("return");
                      }}
                      className="bg-red hover:bg-red/80 text-white font-bold px-3 py-1.5 text-[11px] uppercase tracking-wider"
                    >
                      Process Return
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Modals */}
      {isAddItemOpen && (
        <AddItemModal
          isLead={true}
          onClose={() => setIsAddItemOpen(false)}
          onSuccess={() => fetchStats()}
        />
      )}

      {selectedReq && actionType && (
        <RequestActionModal
          request={selectedReq}
          actionType={actionType}
          onClose={() => {
            setSelectedReq(null);
            setActionType(null);
          }}
          onSuccess={() => fetchStats()}
        />
      )}
    </div>
  );
}
