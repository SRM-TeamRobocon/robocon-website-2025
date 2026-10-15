"use client";

import React, { useState } from "react";
import { X, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import { BazaarRequest } from "@/lib/bazaar/types";
import { formatDate } from "@/lib/bazaar/dates";

export type RequestActionType = "approve" | "reject" | "issue" | "return" | "cancel";

interface RequestActionModalProps {
  request: BazaarRequest | null;
  actionType: RequestActionType | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RequestActionModal({
  request,
  actionType,
  onClose,
  onSuccess,
}: RequestActionModalProps) {
  const [note, setNote] = useState("");
  const [alsoIssue, setAlsoIssue] = useState(false);

  // Return breakdown
  const [goodQty, setGoodQty] = useState(request?.quantity || 1);
  const [damagedQty, setDamagedQty] = useState(0);
  const [lostQty, setLostQty] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!request || !actionType) return null;

  const totalReturnAccounted = goodQty + damagedQty + lostQty;
  const isReturnBalanced = totalReturnAccounted === request.quantity;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (actionType === "reject" && note.trim().length < 3) {
      setErrorMsg("Rejection reason must be at least 3 characters");
      return;
    }

    if (actionType === "return" && !isReturnBalanced) {
      setErrorMsg(
        `Returned items sum (${totalReturnAccounted}) must equal issued quantity (${request.quantity})`
      );
      return;
    }

    setSubmitting(true);
    try {
      let url = "";
      let payload: Record<string, unknown> = {};

      switch (actionType) {
        case "approve":
          url = `/api/bazaar/manage/requests/${request.id}/approve`;
          payload = { note: note.trim() || null, issue: alsoIssue };
          break;
        case "reject":
          url = `/api/bazaar/manage/requests/${request.id}/reject`;
          payload = { note: note.trim() };
          break;
        case "issue":
          url = `/api/bazaar/manage/requests/${request.id}/issue`;
          break;
        case "return":
          url = `/api/bazaar/manage/requests/${request.id}/return`;
          payload = {
            good: goodQty,
            damaged: damagedQty,
            lost: lostQty,
            note: note.trim() || null,
          };
          break;
        case "cancel":
          url = `/api/bazaar/manage/requests/${request.id}/cancel`;
          payload = { note: note.trim() || null };
          break;
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Action failed");
      }

      toast.success("Request updated successfully");
      if (onSuccess) onSuccess();
      onClose();
    } catch (err: unknown) {
      const msg = (err as Error)?.message || "Something went wrong";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  const getTitle = () => {
    switch (actionType) {
      case "approve":
        return "Approve Component Request";
      case "reject":
        return "Reject Component Request";
      case "issue":
        return "Mark Handed Over (Issue)";
      case "return":
        return "Process Component Return";
      case "cancel":
        return "Cancel Component Request";
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-neutral-900 border border-white/10 w-full max-w-md p-6 relative max-h-[90vh] overflow-y-auto shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="border-b border-white/10 pb-3 mb-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-red">
            Workflow Action
          </span>
          <h3 className="text-base font-bold text-white uppercase tracking-wide">
            {getTitle()}
          </h3>
        </div>

        {/* Request Brief */}
        <div className="p-3 bg-black border border-white/10 text-xs space-y-1 mb-4">
          <div className="flex justify-between">
            <span className="text-gray-400">Item:</span>
            <span className="font-bold text-white">
              {request.quantity}x {request.item?.name || request.custom_item_name || "Unlisted Component"}
              {request.custom_item_name && (
                <span className="ml-1.5 text-[9px] uppercase font-bold text-yellow-400">
                  [Unlisted]
                </span>
              )}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Requester:</span>
            <span className="text-white">{request.member_name} {request.member_reg_number ? `(${request.member_reg_number})` : ""}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Dates:</span>
            <span className="text-white">{formatDate(request.taking_date)} &rarr; {formatDate(request.expected_return_date)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-400">Location:</span>
            <span className="text-white">{request.usage_location === "outside" ? "Outside Lab" : "Inside Lab"}{request.location_details ? ` (${request.location_details})` : ""}</span>
          </div>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red/10 border border-red/30 flex items-start gap-2 text-xs text-red">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Approve Options */}
          {actionType === "approve" && (
            <div className="space-y-3">
              <label className="flex items-center gap-2 p-2.5 bg-black border border-white/10 cursor-pointer">
                <input
                  type="checkbox"
                  checked={alsoIssue}
                  onChange={(e) => setAlsoIssue(e.target.checked)}
                  className="accent-red"
                />
                <span className="text-xs text-gray-300">
                  <strong className="text-white">Approve & Issue shortcut</strong> (already handed over physically right now)
                </span>
              </label>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Note to requester <span className="text-gray-600 normal-case">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Come collect from workbench 2 after 5 PM"
                  className="w-full bg-black border border-white/10 text-white p-2 text-xs focus:border-red focus:outline-none placeholder:text-gray-600 resize-none"
                />
              </div>
            </div>
          )}

          {/* Reject Options */}
          {actionType === "reject" && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                Rejection Reason *
              </label>
              <textarea
                rows={3}
                required
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Explain clearly why this request cannot be approved..."
                className="w-full bg-black border border-white/10 text-white p-2 text-xs focus:border-red focus:outline-none placeholder:text-gray-600 resize-none"
              />
            </div>
          )}

          {/* Issue Handover */}
          {actionType === "issue" && (
            <p className="text-xs text-gray-300">
              Confirm that you have physically handed over <strong>{request.quantity} unit(s)</strong> of <strong>{request.item?.name || request.custom_item_name || "component"}</strong> to <strong>{request.member_name}</strong>.
            </p>
          )}

          {/* Return Breakdown */}
          {actionType === "return" && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">
                Please account for all <strong>{request.quantity}</strong> unit(s) returned:
              </p>

              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-bold uppercase text-emerald-400 mb-1">
                    Good Condition
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={request.quantity}
                    value={goodQty}
                    onChange={(e) => setGoodQty(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full bg-black border border-white/10 text-white p-2 text-xs text-center font-bold focus:border-red focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-yellow-400 mb-1">
                    Damaged
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={request.quantity}
                    value={damagedQty}
                    onChange={(e) => setDamagedQty(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full bg-black border border-white/10 text-white p-2 text-xs text-center font-bold focus:border-red focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase text-red mb-1">
                    Lost
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={request.quantity}
                    value={lostQty}
                    onChange={(e) => setLostQty(Math.max(0, parseInt(e.target.value, 10) || 0))}
                    className="w-full bg-black border border-white/10 text-white p-2 text-xs text-center font-bold focus:border-red focus:outline-none"
                  />
                </div>
              </div>

              <div className={`p-2 text-xs flex justify-between ${isReturnBalanced ? "bg-emerald-500/10 text-emerald-400" : "bg-red/10 text-red"}`}>
                <span>Total accounted:</span>
                <span className="font-bold">{totalReturnAccounted} / {request.quantity}</span>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Return Receipt Note <span className="text-gray-600 normal-case">(optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Returned with jumper wires, 1 motor shaft bent"
                  className="w-full bg-black border border-white/10 text-white p-2 text-xs focus:border-red focus:outline-none placeholder:text-gray-600 resize-none"
                />
              </div>
            </div>
          )}

          {/* Cancel */}
          {actionType === "cancel" && (
            <div>
              <p className="text-xs text-gray-300 mb-2">
                Are you sure you want to cancel this request? Reserved stock will be returned to inventory.
              </p>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                Reason / Note <span className="text-gray-600 normal-case">(optional)</span>
              </label>
              <textarea
                rows={2}
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Reason for cancelling..."
                className="w-full bg-black border border-white/10 text-white p-2 text-xs focus:border-red focus:outline-none placeholder:text-gray-600 resize-none"
              />
            </div>
          )}

          {/* Submit buttons */}
          <div className="flex justify-end gap-3 pt-3 border-t border-white/10">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="border border-white/20 text-gray-300 hover:text-white px-4 py-2 text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || (actionType === "return" && !isReturnBalanced)}
              className="bg-red hover:bg-red/80 text-white font-bold px-5 py-2 text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              {submitting ? "Processing..." : "Confirm Action"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
