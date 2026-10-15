"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import Link from "next/link";
import { AlertTriangle, Clock, MapPin, Package, XCircle, ExternalLink } from "lucide-react";
import toast from "react-hot-toast";
import { BazaarNav } from "@/components/bazaar/BazaarNav";
import { StatusBadge } from "@/components/bazaar/StatusBadge";
import { AddItemModal } from "@/components/bazaar/AddItemModal";
import { formatDate } from "@/lib/bazaar/dates";
import { BazaarRequest } from "@/lib/bazaar/types";

export default function MyRequestsPage() {
  const [requests, setRequests] = useState<BazaarRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"active" | "history">("active");
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);

  const fetchMyRequests = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bazaar/requests?pageSize=100");
      const data = await res.json();
      if (data.data) {
        setRequests(data.data);
      }
    } catch {
      toast.error("Failed to load your requests");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchMyRequests();
  }, [fetchMyRequests]);

  const handleCancelRequest = async (id: string, itemName: string) => {
    if (!confirm(`Are you sure you want to cancel your request for "${itemName}"?`)) {
      return;
    }

    setCancellingId(id);
    try {
      const res = await fetch(`/api/bazaar/requests/${id}/cancel`, {
        method: "POST",
      });
      const data = await res.json();
      if (res.ok && data.ok) {
        toast.success("Request cancelled");
        fetchMyRequests();
      } else {
        toast.error(data.error?.message || "Failed to cancel request");
      }
    } catch {
      toast.error("Failed to cancel request");
    } finally {
      setCancellingId(null);
    }
  };

  const activeRequests = requests.filter((r) =>
    ["pending", "approved", "issued"].includes(r.status)
  );
  const historyRequests = requests.filter((r) =>
    ["returned", "rejected", "cancelled"].includes(r.status)
  );

  const overdueRequests = activeRequests.filter((r) => r.is_overdue);
  const displayedRequests = activeTab === "active" ? activeRequests : historyRequests;

  return (
    <div className="space-y-6">
      <BazaarNav onOpenAddItem={() => setIsAddItemOpen(true)} />

      {/* Overdue Warning Banner */}
      {overdueRequests.length > 0 && (
        <div className="p-4 bg-red/10 border-l-4 border-red border border-red/20 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red shrink-0 mt-0.5" />
          <div className="text-xs space-y-1">
            <h4 className="font-bold text-white uppercase tracking-wider">
              You Have {overdueRequests.length} Overdue Component(s)
            </h4>
            <p className="text-gray-300">
              Please return the overdue items to the lab leads as soon as possible so other members can use them.
            </p>
          </div>
        </div>
      )}

      {/* View Tabs */}
      <div className="flex border-b border-white/10">
        <button
          onClick={() => setActiveTab("active")}
          className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "active"
              ? "border-red text-white bg-white/5"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          Active Loans & Requests
          <span className="bg-neutral-800 text-gray-300 px-2 py-0.5 text-[10px] rounded-full">
            {activeRequests.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`px-5 py-2.5 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === "history"
              ? "border-red text-white bg-white/5"
              : "border-transparent text-gray-400 hover:text-white"
          }`}
        >
          History & Closed
          <span className="bg-neutral-800 text-gray-300 px-2 py-0.5 text-[10px] rounded-full">
            {historyRequests.length}
          </span>
        </button>
      </div>

      {/* Requests Content */}
      {loading ? (
        <div className="p-16 border border-white/10 bg-black text-center space-y-2">
          <div className="w-6 h-6 border-2 border-red border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs uppercase tracking-widest text-gray-500 font-bold">
            Loading Requests...
          </p>
        </div>
      ) : displayedRequests.length === 0 ? (
        <div className="p-16 border border-white/10 bg-black text-center space-y-3">
          <Clock className="w-10 h-10 text-gray-600 mx-auto" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            {activeTab === "active" ? "No Active Requests" : "No Closed Requests"}
          </h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            {activeTab === "active"
              ? "You do not currently have any pending, approved, or issued components."
              : "You have no past loan history in the system yet."}
          </p>
          {activeTab === "active" && (
            <Link
              href="/dashboard/bazaar"
              className="mt-2 bg-red hover:bg-red/80 text-white font-bold px-4 py-2 text-xs uppercase tracking-wider inline-flex items-center gap-1.5"
            >
              Browse Components
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {displayedRequests.map((req) => {
            const canCancel = ["pending", "approved"].includes(req.status);
            return (
              <div
                key={req.id}
                className="bg-black border border-white/10 p-5 hover:border-white/20 transition-colors space-y-4"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/5 pb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-neutral-900 border border-white/10 shrink-0 relative overflow-hidden flex items-center justify-center">
                      {req.item?.image_url ? (
                        <Image
                          src={req.item.image_url}
                          alt={req.item.name || "Item"}
                          fill
                          className="object-cover"
                          sizes="48px"
                        />
                      ) : (
                        <Package className="w-5 h-5 text-gray-600" />
                      )}
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white flex items-center gap-2">
                        <span>{req.quantity}x {req.item?.name || req.custom_item_name || "Component"}</span>
                        {req.custom_item_name && (
                          <span className="text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                            Unlisted
                          </span>
                        )}
                      </h3>
                      <div className="text-[11px] text-gray-500">
                        Requested on {formatDate(req.created_at)}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 self-start sm:self-auto">
                    <StatusBadge status={req.status} isOverdue={req.is_overdue} />
                    {canCancel && (
                      <button
                        onClick={() => handleCancelRequest(req.id, req.item?.name || req.custom_item_name || "Item")}
                        disabled={cancellingId === req.id}
                        className="text-gray-400 hover:text-red border border-white/10 hover:border-red/40 px-3 py-1 text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-50"
                      >
                        {cancellingId === req.id ? "Cancelling..." : "Cancel"}
                      </button>
                    )}
                  </div>
                </div>

                {/* Details Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 text-xs">
                  <div>
                    <span className="text-gray-500 block uppercase tracking-wider text-[10px]">
                      Dates
                    </span>
                    <span className="text-white font-medium">
                      {formatDate(req.taking_date)} &rarr;{" "}
                      <strong className={req.is_overdue ? "text-red" : "text-white"}>
                        {formatDate(req.expected_return_date)}
                      </strong>
                    </span>
                    {req.is_overdue && (
                      <span className="text-red font-bold block text-[11px] mt-0.5">
                        ({req.days_overdue} days overdue)
                      </span>
                    )}
                  </div>

                  <div>
                    <span className="text-gray-500 block uppercase tracking-wider text-[10px]">
                      Location
                    </span>
                    <span className="text-gray-300">
                      {req.usage_location === "outside" ? "Outside Lab" : "Inside Lab"}
                      {req.location_details ? ` (${req.location_details})` : ""}
                    </span>
                  </div>

                  <div className="md:col-span-2">
                    <span className="text-gray-500 block uppercase tracking-wider text-[10px]">
                      Purpose
                    </span>
                    <span className="text-gray-300 line-clamp-2">
                      {req.purpose}
                      {req.project_name ? ` (Project: ${req.project_name})` : ""}
                    </span>
                  </div>
                </div>

                {/* Lead Notes / Rejection Reason / Return Breakdown */}
                {req.decision_note && (
                  <div className="p-3 bg-neutral-900 border-l-2 border-yellow-500 text-xs text-gray-300">
                    <strong className="text-yellow-400">Lead Note:</strong> {req.decision_note}
                  </div>
                )}

                {req.status === "returned" && (
                  <div className="p-3 bg-neutral-900 border border-white/5 text-xs text-gray-400 flex flex-wrap gap-4">
                    <span>
                      Returned on: <strong className="text-white">{formatDate(req.returned_at)}</strong>
                    </span>
                    <span>
                      Good condition: <strong className="text-emerald-400">{req.returned_good_qty ?? 0}</strong>
                    </span>
                    {(req.returned_damaged_qty ?? 0) > 0 && (
                      <span>
                        Damaged: <strong className="text-yellow-400">{req.returned_damaged_qty}</strong>
                      </span>
                    )}
                    {(req.returned_lost_qty ?? 0) > 0 && (
                      <span>
                        Lost: <strong className="text-red">{req.returned_lost_qty}</strong>
                      </span>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {isAddItemOpen && (
        <AddItemModal
          onClose={() => setIsAddItemOpen(false)}
          onSuccess={() => fetchMyRequests()}
        />
      )}
    </div>
  );
}
