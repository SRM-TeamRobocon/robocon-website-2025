"use client";

import React, { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { X, Upload, Plus, AlertCircle } from "lucide-react";
import toast from "react-hot-toast";
import { BazaarCategory } from "@/lib/bazaar/types";

interface AddItemModalProps {
  onClose: () => void;
  onSuccess?: () => void;
  isLead?: boolean;
}

export function AddItemModal({ onClose, onSuccess, isLead = false }: AddItemModalProps) {
  const [categories, setCategories] = useState<BazaarCategory[]>([]);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewCatInput, setShowNewCatInput] = useState(false);
  const [location, setLocation] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [totalQuantity, setTotalQuantity] = useState(1);
  const [lowStockThreshold, setLowStockThreshold] = useState(0);

  const [uploadingImage, setUploadingImage] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/bazaar/categories")
      .then((res) => res.json())
      .then((data) => {
        if (data.categories) setCategories(data.categories);
      })
      .catch(() => {});
  }, []);

  const handleCreateCategory = async () => {
    if (!newCategoryName.trim()) return;
    try {
      const res = await fetch("/api/bazaar/manage/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newCategoryName.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.category) {
        setCategories((prev) => [...prev, data.category]);
        setCategoryId(data.category.id);
        setShowNewCatInput(false);
        setNewCategoryName("");
        toast.success("Category added");
      } else {
        toast.error(data.error?.message || "Could not add category");
      }
    } catch {
      toast.error("Failed to add category");
    }
  };

  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image file must be under 2MB");
      return;
    }

    setUploadingImage(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/bazaar/manage/upload", {
        method: "POST",
        body: formData,
      });

      const data = await res.json();
      if (res.ok && data.url) {
        setImageUrl(data.url);
        toast.success("Photo uploaded");
      } else {
        toast.error(data.error?.message || "Failed to upload photo");
      }
    } catch {
      toast.error("Failed to upload photo");
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!name.trim()) {
      setErrorMsg("Component name is required");
      return;
    }

    setSubmitting(true);
    try {
      // Use member items route (which works for all users) or manage route
      const endpoint = isLead ? "/api/bazaar/manage/items" : "/api/bazaar/items";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          category_id: categoryId || null,
          location: location.trim() || null,
          image_url: imageUrl || null,
          total_quantity: Number(totalQuantity),
          low_stock_threshold: Number(lowStockThreshold),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error?.message || "Failed to save item");
      }

      toast.success("Item added to inventory!");
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
      <div className="bg-neutral-900 border border-white/10 w-full max-w-lg p-6 relative max-h-[90vh] overflow-y-auto shadow-2xl">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-white transition-colors"
          aria-label="Close"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="border-b border-white/10 pb-3 mb-4">
          <span className="text-[10px] font-bold uppercase tracking-widest text-red">
            Inventory Registry
          </span>
          <h3 className="text-lg font-bold text-white uppercase tracking-wide">
            Add New Component
          </h3>
        </div>

        {errorMsg && (
          <div className="mb-4 p-3 bg-red/10 border border-red/30 flex items-start gap-2 text-xs text-red">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
              Component Name *
            </label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. N20 Micro Gear Motor 12V 300RPM"
              className="w-full bg-black border border-white/10 text-white px-3 py-2 text-xs focus:border-red focus:outline-none placeholder:text-gray-600"
            />
          </div>

          {/* Category */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Category
              </label>
              <button
                type="button"
                onClick={() => setShowNewCatInput(!showNewCatInput)}
                className="text-[10px] font-bold uppercase tracking-wider text-red hover:underline"
              >
                {showNewCatInput ? "Cancel" : "+ New Category"}
              </button>
            </div>

            {showNewCatInput ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="New category name"
                  value={newCategoryName}
                  onChange={(e) => setNewCategoryName(e.target.value)}
                  className="flex-1 bg-black border border-white/10 text-white px-3 py-2 text-xs focus:border-red focus:outline-none placeholder:text-gray-600"
                />
                <button
                  type="button"
                  onClick={handleCreateCategory}
                  className="bg-red hover:bg-red/80 text-white font-bold px-3 py-2 text-xs uppercase"
                >
                  Save
                </button>
              </div>
            ) : (
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                className="w-full bg-black border border-white/10 text-white px-3 py-2 text-xs focus:border-red focus:outline-none"
              >
                <option value="">-- Select Category (optional) --</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Location & Quantity */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                Storage Location
              </label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="e.g. Shelf A-2 / Bin 14"
                className="w-full bg-black border border-white/10 text-white px-3 py-2 text-xs focus:border-red focus:outline-none placeholder:text-gray-600"
              />
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
                Total Quantity *
              </label>
              <input
                type="number"
                min={0}
                required
                value={totalQuantity}
                onChange={(e) => setTotalQuantity(Math.max(0, parseInt(e.target.value, 10) || 0))}
                className="w-full bg-black border border-white/10 text-white px-3 py-2 text-xs focus:border-red focus:outline-none"
              />
            </div>
          </div>

          {/* Low stock threshold */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
              Low Stock Alert Threshold
            </label>
            <input
              type="number"
              min={0}
              value={lowStockThreshold}
              onChange={(e) => setLowStockThreshold(Math.max(0, parseInt(e.target.value, 10) || 0))}
              placeholder="0 disables warning badge"
              className="w-full bg-black border border-white/10 text-white px-3 py-2 text-xs focus:border-red focus:outline-none placeholder:text-gray-600"
            />
          </div>

          {/* Description */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
              Description / Specs <span className="text-gray-600 normal-case">(optional)</span>
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Key specifications, pinout notes, or documentation link..."
              className="w-full bg-black border border-white/10 text-white p-2.5 text-xs focus:border-red focus:outline-none placeholder:text-gray-600 resize-none"
            />
          </div>

          {/* Photo upload */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-400 mb-1">
              Component Photo
            </label>
            <input
              type="file"
              ref={fileInputRef}
              accept="image/png,image/jpeg,image/webp"
              onChange={handleImageFileChange}
              className="hidden"
            />

            <div className="flex items-center gap-4">
              <div className="w-16 h-16 bg-black border border-white/10 shrink-0 relative overflow-hidden flex items-center justify-center">
                {imageUrl ? (
                  <Image
                    src={imageUrl}
                    alt="Preview"
                    fill
                    className="object-cover"
                    sizes="64px"
                  />
                ) : (
                  <Upload className="w-5 h-5 text-gray-600" />
                )}
              </div>

              <div className="space-y-1">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingImage}
                  className="border border-white/20 hover:border-white/40 text-gray-300 hover:text-white px-3 py-1.5 text-xs font-semibold uppercase tracking-wider transition-colors disabled:opacity-50"
                >
                  {uploadingImage ? "Uploading..." : imageUrl ? "Change Photo" : "Upload Photo"}
                </button>
                <p className="text-[11px] text-gray-500">Max 2 MB (PNG, JPG, or WebP)</p>
              </div>
            </div>
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
              disabled={submitting || uploadingImage}
              className="bg-red hover:bg-red/80 text-white font-bold px-5 py-2 text-xs uppercase tracking-wider transition-colors disabled:opacity-50"
            >
              {submitting ? "Adding..." : "Add to Inventory"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
