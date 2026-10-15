"use client";

import React, { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { X, CheckCircle2, AlertCircle, Calendar, MapPin, Building2, ExternalLink, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { todayIST } from "@/lib/bazaar/dates";
import { BazaarPublicItem } from "@/lib/bazaar/types";

interface BorrowItemRow {
  id: string;
  name: string;
  quantity: number;
  catalogItem?: BazaarPublicItem | null;
}

interface RequestModalProps {
  item: BazaarPublicItem | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export function RequestModal({ item: initialItem, onClose, onSuccess }: RequestModalProps) {
  const today = todayIST();

  const [items, setItems] = useState<BorrowItemRow[]>(() => {
    if (initialItem) {
      return [{ id: "1", name: initialItem.name, quantity: 1, catalogItem: initialItem }];
    }
    return [{ id: "1", name: "", quantity: 1, catalogItem: null }];
  });

  const [takingDate, setTakingDate] = useState(today);
  const [expectedReturnDate, setExpectedReturnDate] = useState(today);
  const [usageLocation, setUsageLocation] = useState<"in_lab" | "outside">("in_lab");
  const [locationDetails, setLocationDetails] = useState("");
  const [purpose, setPurpose] = useState("");
  const [projectName, setProjectName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submittedSummary, setSubmittedSummary] = useState<BorrowItemRow[] | null>(null);

  const handleAddItem = () => {
    setItems((prev) => [
      ...prev,
      { id: Date.now().toString(), name: "", quantity: 1, catalogItem: null },
    ]);
  };

  const handleRemoveItem = (id: string) => {
    if (items.length > 1) {
      setItems((prev) => prev.filter((it) => it.id !== id));
    }
  };

  const handleUpdateQuantity = (id: string, delta: number) => {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, quantity: Math.max(1, it.quantity + delta) } : it
      )
    );
  };

  const handleSetQuantity = (id: string, val: number) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, quantity: Math.max(1, val) } : it))
    );
  };

  const handleUpdateName = (id: string, name: string) => {
    setItems((prev) =>
      prev.map((it) => (it.id === id ? { ...it, name, catalogItem: null } : it))
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const validItems = items.filter((it) => it.name.trim().length > 0);
    if (validItems.length === 0) {
      setErrorMsg("Please enter at least one component name.");
      return;
    }

    for (const it of validItems) {
      if (it.quantity < 1) {
        setErrorMsg(`Quantity for "${it.name}" must be at least 1.`);
        return;
      }
    }

    if (takingDate < today) {
      setErrorMsg("Taking date cannot be in the past.");
      return;
    }
    if (expectedReturnDate < takingDate) {
      setErrorMsg("Return date cannot be earlier than taking date.");
      return;
    }
    if (purpose.trim().length < 2) {
      setErrorMsg("Please provide a valid purpose (at least 2 characters).");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        items: validItems.map((it) => ({
          item_id: it.catalogItem ? it.catalogItem.id : null,
          custom_item_name: it.name.trim(),
          quantity: it.quantity,
        })),
        taking_date: takingDate,
        expected_return_date: expectedReturnDate,
        usage_location: usageLocation,
        location_details: usageLocation === "outside" ? locationDetails.trim() || null : null,
        purpose: purpose.trim(),
        project_name: projectName.trim() || null,
      };

      const res = await fetch("/api/bazaar/requests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to submit request");
      }

      toast.success(
        validItems.length > 1
          ? `Submitted request for ${validItems.length} components!`
          : "Request submitted successfully!"
      );
      setSubmittedSummary(validItems);
      if (onSuccess) onSuccess();
    } catch (err: unknown) {
      const msg = (err as Error)?.message || "Something went wrong";
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-neutral-900 border border-white/10 w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        {submittedSummary ? (
          <div className="text-center py-6 space-y-4">
            <CheckCircle2 className="w-12 h-12 text-emerald-400 mx-auto" />
            <h3 className="text-lg font-bold text-white uppercase tracking-wide">
              Request Submitted
            </h3>
            <p className="text-xs text-gray-400">
              Your borrowing request for the following component(s) has been logged:
            </p>

            <div className="bg-black border border-white/10 p-3 text-left divide-y divide-white/5 max-h-48 overflow-y-auto">
              {submittedSummary.map((it, idx) => (
                <div key={idx} className="py-1.5 flex justify-between items-center text-xs">
                  <span className="text-white font-medium">{it.name}</span>
                  <span className="font-mono font-bold text-red bg-red/10 border border-red/30 px-2 py-0.5 rounded text-[11px]">
                    Qty: {it.quantity}
                  </span>
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-500">
              A lead will review and hand over the requested components.
            </p>

            <div className="flex justify-center gap-3 pt-2">
              <Link
                href="/dashboard/bazaar/my-requests"
                className="bg-red hover:bg-red/80 text-white font-bold px-4 py-2 text-xs uppercase tracking-wider inline-flex items-center gap-2"
              >
                View My Requests <ExternalLink className="w-3.5 h-3.5" />
              </Link>
              <button
                onClick={onClose}
                className="border border-white/20 text-gray-300 hover:text-white px-4 py-2 text-xs font-semibold uppercase tracking-wider"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Modal Header */}
            <div className="border-b border-white/10 pb-3">
              <span className="text-[10px] font-bold uppercase tracking-widest text-red">
                Lab Borrow Checkout
              </span>
              <h3 className="text-base font-bold text-white uppercase tracking-wide">
                Take / Borrow Components
              </h3>
              <p className="text-[11px] text-gray-400 mt-0.5">
                Log the components and individual quantities you are taking or requesting.
              </p>
            </div>

            {errorMsg && (
              <div className="p-3 bg-red/10 border border-red/30 flex items-start gap-2 text-xs text-red">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Components & Individual Quantities List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-300">
                  Components & Individual Quantities *
                </label>
                <span className="text-[11px] text-gray-500 font-medium">
                  {items.length} item{items.length > 1 ? "s" : ""}
                </span>
              </div>

              <div className="space-y-2">
                {items.map((row, idx) => (
                  <div
                    key={row.id}
                    className="p-3 bg-black border border-white/10 space-y-2 relative rounded-none"
                  >
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="font-bold text-red uppercase tracking-wider">
                        Component #{idx + 1}
                      </span>
                      {items.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleRemoveItem(row.id)}
                          className="text-gray-500 hover:text-red transition-colors flex items-center gap-1 text-[11px]"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Remove
                        </button>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      {/* Component Name */}
                      <div className="sm:col-span-8">
                        <input
                          type="text"
                          placeholder="Component name (e.g. Multimeter, 5V Relay, Battery...)"
                          value={row.name}
                          onChange={(e) => handleUpdateName(row.id, e.target.value)}
                          className="w-full bg-neutral-900 border border-white/10 text-white px-3 py-2 text-xs focus:border-red focus:outline-none placeholder:text-gray-600"
                          required
                        />
                      </div>

                      {/* Individual Quantity Counter */}
                      <div className="sm:col-span-4 flex items-center justify-end sm:justify-start gap-1">
                        <span className="text-[11px] text-gray-400 mr-1 sm:hidden">Qty:</span>
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(row.id, -1)}
                          className="w-8 h-8 bg-neutral-900 border border-white/10 text-white font-bold hover:bg-white/10 transition-colors flex items-center justify-center text-xs"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          min={1}
                          value={row.quantity}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            if (!isNaN(val)) handleSetQuantity(row.id, val);
                          }}
                          className="w-14 text-center bg-neutral-900 border border-white/10 text-white font-bold h-8 text-xs focus:border-red focus:outline-none"
                          required
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateQuantity(row.id, 1)}
                          className="w-8 h-8 bg-neutral-900 border border-white/10 text-white font-bold hover:bg-white/10 transition-colors flex items-center justify-center text-xs"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Another Component Button */}
              <button
                type="button"
                onClick={handleAddItem}
                className="w-full py-2 border border-dashed border-white/20 hover:border-red/60 text-gray-300 hover:text-white bg-white/[0.02] hover:bg-red/5 text-xs font-bold uppercase tracking-wider transition-colors flex items-center justify-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-red" />
                + Add Another Component
              </button>
            </div>

            {/* Dates: Taking date & Expected Return date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-white/5">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Taking Date (When you need) *
                </label>
                <div className="relative">
                  <input
                    type="date"
                    min={today}
                    value={takingDate}
                    onChange={(e) => {
                      setTakingDate(e.target.value);
                      if (e.target.value > expectedReturnDate) {
                        setExpectedReturnDate(e.target.value);
                      }
                    }}
                    className="w-full bg-black border border-white/10 text-white px-3 py-2 text-xs focus:border-red focus:outline-none"
                    required
                  />
                  <Calendar className="w-3.5 h-3.5 text-gray-500 absolute right-3 top-2.5 pointer-events-none" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                  Expected Return (Till when) *
                </label>
                <div className="relative">
                  <input
                    type="date"
                    min={takingDate}
                    value={expectedReturnDate}
                    onChange={(e) => setExpectedReturnDate(e.target.value)}
                    className="w-full bg-black border border-white/10 text-white px-3 py-2 text-xs focus:border-red focus:outline-none"
                    required
                  />
                  <Calendar className="w-3.5 h-3.5 text-gray-500 absolute right-3 top-2.5 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Usage Location: In Lab vs Outside */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                Where will you use it? *
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setUsageLocation("in_lab")}
                  className={`flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider border transition-colors ${
                    usageLocation === "in_lab"
                      ? "bg-red/20 border-red text-white"
                      : "bg-black border-white/10 text-gray-400 hover:text-white"
                  }`}
                >
                  <Building2 className="w-3.5 h-3.5" /> Inside Lab
                </button>

                <button
                  type="button"
                  onClick={() => setUsageLocation("outside")}
                  className={`flex items-center justify-center gap-2 px-3 py-2 text-xs font-bold uppercase tracking-wider border transition-colors ${
                    usageLocation === "outside"
                      ? "bg-red/20 border-red text-white"
                      : "bg-black border-white/10 text-gray-400 hover:text-white"
                  }`}
                >
                  <ExternalLink className="w-3.5 h-3.5" /> Outside Lab
                </button>
              </div>

              {usageLocation === "outside" && (
                <div className="mt-2">
                  <input
                    type="text"
                    placeholder="Specific location (e.g. Mechanical Workshop, Tech Park, Hostel)"
                    value={locationDetails}
                    onChange={(e) => setLocationDetails(e.target.value)}
                    className="w-full bg-black border border-white/10 text-white px-3 py-2 text-xs focus:border-red focus:outline-none placeholder:text-gray-600"
                  />
                </div>
              )}
            </div>

            {/* Purpose */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                Purpose / Reason (Why you need it) *
              </label>
              <textarea
                rows={2}
                value={purpose}
                onChange={(e) => setPurpose(e.target.value)}
                placeholder="Briefly explain what you need this component for..."
                className="w-full bg-black border border-white/10 text-white p-2.5 text-xs focus:border-red focus:outline-none placeholder:text-gray-600 resize-none"
                required
              />
            </div>

            {/* Project Name (Optional) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                Project Name <span className="text-gray-600 normal-case">(optional)</span>
              </label>
              <input
                type="text"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="e.g. Robocon 2026 Bot A / Stepper Rig"
                className="w-full bg-black border border-white/10 text-white px-3 py-2 text-xs focus:border-red focus:outline-none placeholder:text-gray-600"
              />
            </div>

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
                disabled={submitting}
                className="bg-red hover:bg-red/80 text-white font-bold px-5 py-2 text-xs uppercase tracking-wider transition-colors disabled:opacity-50 flex items-center gap-1.5"
              >
                {submitting ? "Submitting..." : `Submit Request (${items.length} item${items.length > 1 ? "s" : ""})`}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
