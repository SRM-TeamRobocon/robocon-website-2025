"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import {
  Search,
  CheckCircle,
  XCircle,
  Package,
  Clock,
  AlertTriangle,
  RotateCcw,
  FileSpreadsheet,
  Building2,
  ExternalLink,
} from "lucide-react";
import toast from "react-hot-toast";
import { BazaarNav } from "@/components/bazaar/BazaarNav";
import { StatusBadge } from "@/components/bazaar/StatusBadge";
import { RequestActionModal, RequestActionType } from "@/components/bazaar/RequestActionModal";
import { AddItemModal } from "@/components/bazaar/AddItemModal";
import { formatDate } from "@/lib/bazaar/dates";
import { BazaarRequest } from "@/lib/bazaar/types";

type TabFilter = "all" | "pending" | "approved" | "issued" | "overdue" | "history";

function RequestsQueueContent() {
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get("status") || (searchParams.get("overdue") === "1" ? "overdue" : "all");

  const [activeTab, setActiveTab] = useState<TabFilter>(
    ["pending", "approved", "issued", "overdue"].includes(initialStatus)
      ? (initialStatus as TabFilter)
      : "all"
  );
  const [requests, setRequests] = useState<BazaarRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Modals
  const [selectedReq, setSelectedReq] = useState<BazaarRequest | null>(null);
  const [actionType, setActionType] = useState<RequestActionType | null>(null);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (activeTab === "overdue") {
        params.set("overdue", "1");
      } else if (activeTab === "history") {
        // history is returned, rejected, cancelled
      } else if (activeTab !== "all") {
        params.set("status", activeTab);
      }
      params.set("pageSize", "100");

      const res = await fetch(`/api/bazaar/manage/requests?${params.toString()}`);
      const data = await res.json();
      if (data.data) {
        let result: BazaarRequest[] = data.data;
        if (activeTab === "history") {
          result = result.filter((r) => ["returned", "rejected", "cancelled"].includes(r.status));
        }
        setRequests(result);
      }
    } catch {
      toast.error("Failed to load requests queue");
    } finally {
      setLoading(false);
    }
  }, [activeTab, search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRequests();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchRequests]);

  const tabs: { id: TabFilter; label: string }[] = [
    { id: "all", label: "All Requests" },
    { id: "pending", label: "Pending" },
    { id: "approved", label: "To Hand Over" },
    { id: "issued", label: "Issued" },
    { id: "overdue", label: "Overdue" },
    { id: "history", label: "History" },
  ];

  return (
    <div className="space-y-6">
      <BazaarNav onOpenAddItem={() => setIsAddItemOpen(true)} />

      {/* Toolbar & Filter */}
      <div className="bg-black border border-white/10 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search by requester name, reg number..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-neutral-900 border border-white/10 pl-9 pr-3 py-2 text-xs text-white placeholder:text-gray-500 focus:border-red focus:outline-none"
            />
          </div>

          <a
            href="/api/bazaar/manage/export?type=requests"
            className="border border-white/20 hover:border-white/40 text-gray-300 hover:text-white px-3.5 py-2 text-xs font-semibold uppercase tracking-wider transition-colors inline-flex items-center gap-1.5 self-start sm:self-auto"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> Export CSV
          </a>
        </div>

        {/* Status Tabs */}
        <div className="flex flex-wrap gap-1 pt-2 border-t border-white/5">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-3 py-1.5 text-xs font-bold uppercase tracking-wider border transition-colors ${
                activeTab === tab.id
                  ? tab.id === "overdue"
                    ? "bg-red text-white border-red"
                    : "bg-white/10 text-white border-white/30"
                  : "bg-neutral-900 border-white/10 text-gray-400 hover:text-white"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Requests Table */}
      {loading ? (
        <div className="p-16 border border-white/10 bg-black text-center space-y-2">
          <div className="w-6 h-6 border-2 border-red border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs uppercase tracking-widest text-gray-500 font-bold">
            Loading Queue...
          </p>
        </div>
      ) : requests.length === 0 ? (
        <div className="p-16 border border-white/10 bg-black text-center space-y-3">
          <Clock className="w-10 h-10 text-gray-600 mx-auto" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            No Requests Found
          </h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            There are no requests matching your current filter in this tab.
          </p>
        </div>
      ) : (
        <div className="border border-white/10 bg-black overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-widest text-gray-400 border-b border-white/10 bg-neutral-900/60">
                <th className="px-4 py-3">Requester</th>
                <th className="px-3 py-3">Component</th>
                <th className="px-3 py-3">Dates</th>
                <th className="px-3 py-3">Location</th>
                <th className="px-3 py-3">Purpose</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {requests.map((req) => (
                <tr key={req.id} className="hover:bg-white/[0.02] transition-colors">
                  {/* Requester */}
                  <td className="px-4 py-3">
                    <div className="font-bold text-white">{req.member_name}</div>
                    {req.member_reg_number && (
                      <div className="text-[11px] text-gray-400 font-mono">
                        {req.member_reg_number}
                      </div>
                    )}
                    {req.member_email && (
                      <div className="text-[11px] text-gray-500 truncate max-w-[140px]">
                        {req.member_email}
                      </div>
                    )}
                  </td>

                  {/* Component */}
                  <td className="px-3 py-3">
                    <div className="font-bold text-white">
                      {req.quantity}x {req.item?.name || req.custom_item_name || "Item"}
                    </div>
                    {req.custom_item_name && (
                      <span className="inline-block mt-0.5 text-[10px] uppercase font-bold tracking-wider px-1.5 py-0.5 bg-yellow-500/20 text-yellow-400 border border-yellow-500/30">
                        Unlisted Component
                      </span>
                    )}
                    {req.item?.available_quantity !== undefined && (
                      <div className="text-[11px] text-emerald-400">
                        {req.item.available_quantity} available in stock
                      </div>
                    )}
                  </td>

                  {/* Dates */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <div>
                      <span className="text-gray-400 text-[10px] uppercase">Taking:</span>{" "}
                      <span className="text-white">{formatDate(req.taking_date)}</span>
                    </div>
                    <div>
                      <span className="text-gray-400 text-[10px] uppercase">Return:</span>{" "}
                      <strong className={req.is_overdue ? "text-red" : "text-gray-200"}>
                        {formatDate(req.expected_return_date)}
                      </strong>
                    </div>
                    {req.is_overdue && (
                      <span className="text-red font-bold text-[10px] block">
                        ({req.days_overdue}d overdue)
                      </span>
                    )}
                  </td>

                  {/* Usage Location */}
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1 text-gray-300">
                      {req.usage_location === "outside" ? (
                        <ExternalLink className="w-3 h-3 text-yellow-400" />
                      ) : (
                        <Building2 className="w-3 h-3 text-gray-400" />
                      )}
                      <span>{req.usage_location === "outside" ? "Outside Lab" : "In Lab"}</span>
                    </div>
                    {req.location_details && (
                      <div className="text-[10px] text-gray-500 truncate max-w-[120px]">
                        {req.location_details}
                      </div>
                    )}
                  </td>

                  {/* Purpose */}
                  <td className="px-3 py-3 max-w-xs">
                    <div className="text-gray-300 line-clamp-2">{req.purpose}</div>
                    {req.project_name && (
                      <div className="text-[10px] text-red font-semibold truncate">
                        Proj: {req.project_name}
                      </div>
                    )}
                    {req.decision_note && (
                      <div className="text-[10px] text-yellow-400/90 italic truncate mt-0.5">
                        Note: {req.decision_note}
                      </div>
                    )}
                  </td>

                  {/* Status Badge */}
                  <td className="px-3 py-3 whitespace-nowrap">
                    <StatusBadge status={req.status} isOverdue={req.is_overdue} />
                  </td>

                  {/* Lead Action Buttons */}
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      {req.status === "pending" && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedReq(req);
                              setActionType("approve");
                            }}
                            className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-2.5 py-1 text-[11px] uppercase tracking-wider"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() => {
                              setSelectedReq(req);
                              setActionType("reject");
                            }}
                            className="border border-red/40 text-red hover:bg-red/10 font-bold px-2 py-1 text-[11px] uppercase tracking-wider"
                          >
                            Reject
                          </button>
                        </>
                      )}

                      {req.status === "approved" && (
                        <>
                          <button
                            onClick={() => {
                              setSelectedReq(req);
                              setActionType("issue");
                            }}
                            className="bg-blue-600 hover:bg-blue-500 text-white font-bold px-2.5 py-1 text-[11px] uppercase tracking-wider"
                          >
                            Hand Over
                          </button>
                          <button
                            onClick={() => {
                              setSelectedReq(req);
                              setActionType("cancel");
                            }}
                            className="border border-white/20 text-gray-400 hover:text-white px-2 py-1 text-[11px] font-semibold uppercase tracking-wider"
                          >
                            Cancel
                          </button>
                        </>
                      )}

                      {req.status === "issued" && (
                        <button
                          onClick={() => {
                            setSelectedReq(req);
                            setActionType("return");
                          }}
                          className="bg-red hover:bg-red/80 text-white font-bold px-2.5 py-1 text-[11px] uppercase tracking-wider"
                        >
                          Return
                        </button>
                      )}

                      {["returned", "rejected", "cancelled"].includes(req.status) && (
                        <span className="text-[11px] text-gray-500 italic">Closed</span>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {selectedReq && actionType && (
        <RequestActionModal
          request={selectedReq}
          actionType={actionType}
          onClose={() => {
            setSelectedReq(null);
            setActionType(null);
          }}
          onSuccess={() => fetchRequests()}
        />
      )}

      {isAddItemOpen && (
        <AddItemModal
          isLead={true}
          onClose={() => setIsAddItemOpen(false)}
          onSuccess={() => fetchRequests()}
        />
      )}
    </div>
  );
}

export default function BazaarManageRequestsPage() {
  return (
    <React.Suspense
      fallback={
        <div className="p-16 border border-white/10 bg-black text-center space-y-2">
          <div className="w-6 h-6 border-2 border-red border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs uppercase tracking-widest text-gray-500 font-bold">
            Loading Queue...
          </p>
        </div>
      }
    >
      <RequestsQueueContent />
    </React.Suspense>
  );
}
