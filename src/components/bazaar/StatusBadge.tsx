import React from "react";
import { RequestStatus } from "@/lib/bazaar/types";

interface StatusBadgeProps {
  status: RequestStatus;
  isOverdue?: boolean;
  className?: string;
}

export function StatusBadge({ status, isOverdue = false, className = "" }: StatusBadgeProps) {
  if (status === "issued" && isOverdue) {
    return (
      <span
        className={`inline-flex items-center px-2 py-0.5 text-xs font-bold uppercase tracking-wider bg-red/20 text-red border border-red/40 animate-pulse ${className}`}
      >
        Overdue
      </span>
    );
  }

  switch (status) {
    case "pending":
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-yellow-500/10 text-yellow-400 border border-yellow-500/30 ${className}`}
        >
          Pending
        </span>
      );
    case "approved":
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-blue-500/10 text-blue-400 border border-blue-500/30 ${className}`}
        >
          Approved
        </span>
      );
    case "issued":
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 ${className}`}
        >
          Issued
        </span>
      );
    case "returned":
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-gray-500/10 text-gray-300 border border-gray-500/30 ${className}`}
        >
          Returned
        </span>
      );
    case "rejected":
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-red/10 text-red/80 border border-red/20 ${className}`}
        >
          Rejected
        </span>
      );
    case "cancelled":
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-white/5 text-gray-400 border border-white/10 ${className}`}
        >
          Cancelled
        </span>
      );
    default:
      return (
        <span
          className={`inline-flex items-center px-2 py-0.5 text-xs font-semibold uppercase tracking-wider bg-white/5 text-gray-400 border border-white/10 ${className}`}
        >
          {status}
        </span>
      );
  }
}
