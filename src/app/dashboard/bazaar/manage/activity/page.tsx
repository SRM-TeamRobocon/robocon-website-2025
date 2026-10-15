"use client";

import React, { useState, useEffect, useCallback } from "react";
import { History, ShieldAlert, ArrowRight, User, Package, Calendar } from "lucide-react";
import { BazaarNav } from "@/components/bazaar/BazaarNav";
import { AddItemModal } from "@/components/bazaar/AddItemModal";
import { formatDateTime } from "@/lib/bazaar/dates";
import { BazaarActivity } from "@/lib/bazaar/types";

export default function BazaarManageActivityPage() {
  const [logs, setLogs] = useState<BazaarActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bazaar/manage/activity?pageSize=100");
      const data = await res.json();
      if (data.data) {
        setLogs(data.data);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const getActionBadge = (action: string) => {
    switch (action) {
      case "request_created":
        return <span className="text-yellow-400 bg-yellow-500/10 border border-yellow-500/30 px-2 py-0.5 text-[10px] uppercase font-bold">Requested</span>;
      case "approved":
        return <span className="text-blue-400 bg-blue-500/10 border border-blue-500/30 px-2 py-0.5 text-[10px] uppercase font-bold">Approved</span>;
      case "approved_and_issued":
        return <span className="text-blue-300 bg-blue-500/20 border border-blue-500/40 px-2 py-0.5 text-[10px] uppercase font-bold">Approved & Issued</span>;
      case "issued":
        return <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] uppercase font-bold">Issued</span>;
      case "returned":
        return <span className="text-gray-300 bg-gray-500/10 border border-gray-500/30 px-2 py-0.5 text-[10px] uppercase font-bold">Returned</span>;
      case "rejected":
        return <span className="text-red/90 bg-red/10 border border-red/20 px-2 py-0.5 text-[10px] uppercase font-bold">Rejected</span>;
      case "cancelled":
        return <span className="text-gray-400 bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] uppercase font-bold">Cancelled</span>;
      case "stock_adjusted":
        return <span className="text-purple-400 bg-purple-500/10 border border-purple-500/30 px-2 py-0.5 text-[10px] uppercase font-bold">Stock Adjusted</span>;
      case "item_created":
        return <span className="text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] uppercase font-bold">Item Registered</span>;
      case "item_updated":
        return <span className="text-gray-300 bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] uppercase font-bold">Item Updated</span>;
      case "item_deactivated":
        return <span className="text-red/70 bg-red/5 border border-red/20 px-2 py-0.5 text-[10px] uppercase font-bold">Deactivated</span>;
      default:
        return <span className="text-gray-400 bg-white/5 border border-white/10 px-2 py-0.5 text-[10px] uppercase font-bold">{action}</span>;
    }
  };

  return (
    <div className="space-y-6">
      <BazaarNav onOpenAddItem={() => setIsAddItemOpen(true)} />

      <div className="bg-black border border-white/10 p-5 space-y-4">
        <div className="border-b border-white/10 pb-3">
          <span className="text-[10px] font-bold uppercase tracking-widest text-red">
            Security & Audit Trail
          </span>
          <h2 className="text-base font-bold text-white uppercase tracking-wider">
            Activity Log
          </h2>
          <p className="text-xs text-gray-400">
            Immutable log of all component reservations, handovers, returns, and inventory modifications
          </p>
        </div>

        {loading ? (
          <div className="p-16 text-center space-y-2">
            <div className="w-6 h-6 border-2 border-red border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs uppercase tracking-widest text-gray-500 font-bold">
              Loading Audit Trail...
            </p>
          </div>
        ) : logs.length === 0 ? (
          <div className="p-16 text-center space-y-2">
            <History className="w-8 h-8 text-gray-600 mx-auto" />
            <p className="text-xs text-gray-500">No activity logged yet.</p>
          </div>
        ) : (
          <div className="divide-y divide-white/5">
            {logs.map((log) => (
              <div key={log.id} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs hover:bg-white/[0.01]">
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{getActionBadge(log.action)}</div>
                  <div className="space-y-0.5">
                    <div className="text-white font-medium">
                      {log.item?.name ? (
                        <span>
                          Component: <strong className="text-white">{log.item.name}</strong>
                        </span>
                      ) : log.request?.member_name ? (
                        <span>
                          Request by <strong className="text-white">{log.request.member_name}</strong>
                        </span>
                      ) : (
                        <span>Operation: {log.action}</span>
                      )}
                    </div>

                    {/* Detail snapshot */}
                    {log.detail && (
                      <div className="text-[11px] text-gray-400 font-mono">
                        {log.detail.quantity !== undefined && `Qty: ${String(log.detail.quantity)} `}
                        {log.detail.total_delta !== undefined && `Total Δ: ${String(log.detail.total_delta)} `}
                        {log.detail.damaged_delta !== undefined && `Damaged Δ: ${String(log.detail.damaged_delta)} `}
                        {log.detail.good !== undefined && `Good: ${String(log.detail.good)}, Damaged: ${String(log.detail.damaged)}, Lost: ${String(log.detail.lost)} `}
                        {Boolean(log.detail.note) && `[Note: ${String(log.detail.note)}]`}
                      </div>
                    )}
                  </div>
                </div>

                <div className="text-right text-[11px] text-gray-500 shrink-0">
                  <div className="flex items-center sm:justify-end gap-1.5 text-gray-400">
                    <User className="w-3 h-3 text-gray-500" />
                    <span>{log.actor}</span>
                  </div>
                  <div>{formatDateTime(log.created_at)}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {isAddItemOpen && (
        <AddItemModal
          isLead={true}
          onClose={() => setIsAddItemOpen(false)}
          onSuccess={() => fetchLogs()}
        />
      )}
    </div>
  );
}
