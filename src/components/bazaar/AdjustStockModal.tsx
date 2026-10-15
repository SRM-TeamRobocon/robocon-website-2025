"use client";

import React, { useState } from "react";
import { X, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import { BazaarItem } from "@/lib/bazaar/types";

interface AdjustStockModalProps {
  item: BazaarItem | null;
  onClose: () => void;
  onSuccess?: () => void;
}

type AdjustmentType = "purchase" | "write_off_damaged" | "repaired";

export function AdjustStockModal({ item, onClose, onSuccess }: AdjustStockModalProps) {
  const [type, setType] = useState<AdjustmentType>("purchase");
  const [amount, setAmount] = useState(1);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!item) return null;

  // Compute live deltas & preview
  let totalDelta = 0;
  let damagedDelta = 0;

  if (type === "purchase") {
    totalDelta = amount;
    damagedDelta = 0;
  } else if (type === "write_off_damaged") {
    totalDelta = -amount;
    damagedDelta = -amount;
  } else if (type === "repaired") {
    totalDelta = 0;
    damagedDelta = -amount;
  }

  const previewTotal = item.total_quantity + totalDelta;
  const previewDamaged = item.damaged_quantity + damagedDelta;
  const previewAvailable =
    previewTotal - item.reserved_quantity - item.issued_quantity - previewDamaged;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (amount <= 0) {
      setErrorMsg("Adjustment amount must be at least 1");
      return;
    }

    if (totalDelta < 0 && !note.trim()) {
      setErrorMsg("A note explaining write-offs is required");
      return;
    }

    if (previewDamaged < 0 || previewTotal < 0 || previewAvailable < 0) {
      setErrorMsg("Invalid adjustment: numbers cannot be negative");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch(`/api/bazaar/manage/items/${item.id}/stock-adjust`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          total_delta: totalDelta,
          damaged_delta: damagedDelta,
          note: note.trim() || null,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to adjust stock");
      }

      toast.success("Stock adjusted successfully");
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
            Inventory Control
          </span>
          <h3 className="text-base font-bold text-white uppercase tracking-wide">
            Adjust Stock: {item.name}
          </h3>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red/10 border border-red/30 flex items-start gap-2 text-xs text-red">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Adjustment Type Selector */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-2">
              Adjustment Type *
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-2.5 p-2.5 bg-black border border-white/10 cursor-pointer hover:border-white/20 transition-colors">
                <input
                  type="radio"
                  name="adjType"
                  value="purchase"
                  checked={type === "purchase"}
                  onChange={() => setType("purchase")}
                  className="accent-red"
                />
                <div className="text-xs">
                  <div className="font-bold text-white">Add Stock (Purchase / Lab Influx)</div>
                  <div className="text-gray-500">Increases total stock</div>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 bg-black border border-white/10 cursor-pointer hover:border-white/20 transition-colors">
                <input
                  type="radio"
                  name="adjType"
                  value="write_off_damaged"
                  checked={type === "write_off_damaged"}
                  onChange={() => setType("write_off_damaged")}
                  className="accent-red"
                />
                <div className="text-xs">
                  <div className="font-bold text-white">Write Off Damaged (Scrap / Disposal)</div>
                  <div className="text-gray-500">Decreases total & damaged quantities</div>
                </div>
              </label>

              <label className="flex items-center gap-2.5 p-2.5 bg-black border border-white/10 cursor-pointer hover:border-white/20 transition-colors">
                <input
                  type="radio"
                  name="adjType"
                  value="repaired"
                  checked={type === "repaired"}
                  onChange={() => setType("repaired")}
                  className="accent-red"
                />
                <div className="text-xs">
                  <div className="font-bold text-white">Mark Repaired / Restored</div>
                  <div className="text-gray-500">Clears damaged count into available stock</div>
                </div>
              </label>
            </div>
          </div>

          {/* Amount */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
              Units Quantity *
            </label>
            <input
              type="number"
              min={1}
              required
              value={amount}
              onChange={(e) => setAmount(Math.max(1, parseInt(e.target.value, 10) || 1))}
              className="w-full bg-black border border-white/10 text-white px-3 py-2 text-xs focus:border-red focus:outline-none"
            />
          </div>

          {/* Live Preview Box */}
          <div className="p-3 bg-black border border-white/10 text-xs space-y-1.5">
            <div className="font-bold uppercase tracking-wider text-gray-400 mb-1">
              Result Preview
            </div>
            <div className="flex justify-between text-gray-300">
              <span>Total Stock:</span>
              <span>
                {item.total_quantity} &rarr;{" "}
                <strong className={previewTotal < item.total_quantity ? "text-red" : "text-emerald-400"}>
                  {previewTotal}
                </strong>
              </span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>Available:</span>
              <span>
                {item.available_quantity} &rarr;{" "}
                <strong className="text-emerald-400">{previewAvailable}</strong>
              </span>
            </div>
            <div className="flex justify-between text-gray-300">
              <span>Damaged:</span>
              <span>
                {item.damaged_quantity} &rarr;{" "}
                <strong className="text-yellow-400">{previewDamaged}</strong>
              </span>
            </div>
          </div>

          {/* Reason / Note */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
              Note / Explanation {totalDelta < 0 ? "*" : "(optional)"}
            </label>
            <textarea
              rows={2}
              required={totalDelta < 0}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={totalDelta < 0 ? "Mandatory reason for discarding inventory..." : "e.g. Bought from Robu.in invoice #402"}
              className="w-full bg-black border border-white/10 text-white p-2.5 text-xs focus:border-red focus:outline-none placeholder:text-gray-600 resize-none"
            />
          </div>

          {/* Actions */}
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
              className="bg-red hover:bg-red/80 text-white font-bold px-5 py-2 text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              {submitting ? "Saving..." : "Apply Adjustment"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
