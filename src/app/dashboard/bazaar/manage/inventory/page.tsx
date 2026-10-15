"use client";

import React, { useState, useEffect, useCallback } from "react";
import Image from "next/image";
import {
  Search,
  Plus,
  SlidersHorizontal,
  Package,
  Layers,
  MapPin,
  AlertTriangle,
  RotateCcw,
  Tag,
  FileSpreadsheet,
} from "lucide-react";
import toast from "react-hot-toast";
import { BazaarNav } from "@/components/bazaar/BazaarNav";
import { AddItemModal } from "@/components/bazaar/AddItemModal";
import { AdjustStockModal } from "@/components/bazaar/AdjustStockModal";
import { ManageCategoriesModal } from "@/components/bazaar/ManageCategoriesModal";
import { BazaarItem, BazaarCategory } from "@/lib/bazaar/types";

export default function BazaarManageInventoryPage() {
  const [items, setItems] = useState<BazaarItem[]>([]);
  const [categories, setCategories] = useState<BazaarCategory[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [showInactive, setShowInactive] = useState(false);

  // Modals
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [adjustingItem, setAdjustingItem] = useState<BazaarItem | null>(null);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/bazaar/manage/categories");
      const data = await res.json();
      if (data.categories) setCategories(data.categories);
    } catch {}
  }, []);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("q", search.trim());
      if (selectedCategory) params.set("category", selectedCategory);
      if (lowStockOnly) params.set("lowStock", "1");
      if (showInactive) params.set("inactive", "1");
      params.set("pageSize", "100");

      const res = await fetch(`/api/bazaar/manage/items?${params.toString()}`);
      const data = await res.json();
      if (data.data) {
        setItems(data.data);
      }
    } catch {
      toast.error("Failed to load inventory");
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory, lowStockOnly, showInactive]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchItems();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchItems]);

  const toggleItemActive = async (item: BazaarItem) => {
    const action = item.is_active ? "deactivate" : "reactivate";
    if (!confirm(`Are you sure you want to ${action} "${item.name}"?`)) return;

    try {
      if (item.is_active) {
        // DELETE endpoint soft-deactivates
        const res = await fetch(`/api/bazaar/manage/items/${item.id}`, {
          method: "DELETE",
        });
        const data = await res.json();
        if (res.ok) {
          toast.success(data.message || "Item deactivated");
          fetchItems();
        } else {
          toast.error(data.error?.message || "Failed to deactivate item");
        }
      } else {
        // PUT endpoint reactivates
        const res = await fetch(`/api/bazaar/manage/items/${item.id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ is_active: true }),
        });
        if (res.ok) {
          toast.success("Item reactivated");
          fetchItems();
        } else {
          toast.error("Failed to reactivate item");
        }
      }
    } catch {
      toast.error("Operation failed");
    }
  };

  return (
    <div className="space-y-6">
      <BazaarNav onOpenAddItem={() => setIsAddItemOpen(true)} />

      {/* Toolbar */}
      <div className="bg-black border border-white/10 p-4 space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search inventory by name, location..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-neutral-900 border border-white/10 pl-9 pr-3 py-2 text-xs text-white placeholder:text-gray-500 focus:border-red focus:outline-none"
            />
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsCategoriesOpen(true)}
              className="border border-white/20 hover:border-white/40 text-gray-300 hover:text-white px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors inline-flex items-center gap-1.5"
            >
              <Tag className="w-3.5 h-3.5" /> Categories
            </button>
            <a
              href="/api/bazaar/manage/export?type=items"
              className="border border-white/20 hover:border-white/40 text-gray-300 hover:text-white px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-colors inline-flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> Export CSV
            </a>
            <button
              onClick={() => setIsAddItemOpen(true)}
              className="bg-red hover:bg-red/80 text-white font-bold px-4 py-2 text-xs uppercase tracking-wider transition-colors inline-flex items-center gap-1.5"
            >
              <Plus className="w-4 h-4" /> Add Item
            </button>
          </div>
        </div>

        {/* Filters bar */}
        <div className="flex flex-wrap items-center gap-4 pt-2 border-t border-white/5 text-xs text-gray-400">
          {/* Category Dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-gray-500">Category:</span>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="bg-neutral-900 border border-white/10 text-white px-2.5 py-1 text-xs focus:border-red focus:outline-none"
            >
              <option value="">All Categories</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          {/* Low Stock Toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(e) => setLowStockOnly(e.target.checked)}
              className="accent-red"
            />
            <span className="text-gray-300">Low stock only</span>
          </label>

          {/* Show Inactive Toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="accent-red"
            />
            <span className="text-gray-300">Show deactivated items</span>
          </label>
        </div>
      </div>

      {/* Inventory Table */}
      {loading ? (
        <div className="p-16 border border-white/10 bg-black text-center space-y-2">
          <div className="w-6 h-6 border-2 border-red border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs uppercase tracking-widest text-gray-500 font-bold">
            Loading Inventory...
          </p>
        </div>
      ) : items.length === 0 ? (
        <div className="p-16 border border-white/10 bg-black text-center space-y-3">
          <Package className="w-10 h-10 text-gray-600 mx-auto" />
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            No Items Found
          </h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            No inventory matches your current filters.
          </p>
        </div>
      ) : (
        <div className="border border-white/10 bg-black overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left text-[11px] font-bold uppercase tracking-widest text-gray-400 border-b border-white/10 bg-neutral-900/60">
                <th className="px-4 py-3">Component</th>
                <th className="px-3 py-3">Category</th>
                <th className="px-3 py-3">Location</th>
                <th className="px-3 py-3 text-center">Total</th>
                <th className="px-3 py-3 text-center font-bold text-emerald-400">Available</th>
                <th className="px-3 py-3 text-center text-blue-400">Reserved</th>
                <th className="px-3 py-3 text-center text-gray-300">Issued</th>
                <th className="px-3 py-3 text-center text-yellow-400">Damaged</th>
                <th className="px-3 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {items.map((item) => {
                const isLowStock =
                  item.low_stock_threshold > 0 &&
                  item.available_quantity <= item.low_stock_threshold;

                return (
                  <tr
                    key={item.id}
                    className={`hover:bg-white/[0.02] transition-colors ${
                      !item.is_active ? "opacity-60 bg-white/[0.01]" : ""
                    }`}
                  >
                    {/* Component Info */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-neutral-900 border border-white/10 shrink-0 relative overflow-hidden flex items-center justify-center">
                          {item.image_url ? (
                            <Image
                              src={item.image_url}
                              alt={item.name}
                              fill
                              className="object-cover"
                              sizes="40px"
                            />
                          ) : (
                            <Package className="w-4 h-4 text-gray-600" />
                          )}
                        </div>
                        <div>
                          <div className="font-bold text-white line-clamp-1">{item.name}</div>
                          {item.description && (
                            <div className="text-[11px] text-gray-500 line-clamp-1">
                              {item.description}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="px-3 py-3 text-gray-400">
                      {item.category?.name || "—"}
                    </td>

                    {/* Location */}
                    <td className="px-3 py-3 text-gray-400">
                      {item.location ? (
                        <span className="flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-gray-500" />
                          {item.location}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>

                    {/* Counters */}
                    <td className="px-3 py-3 text-center font-bold text-white">
                      {item.total_quantity}
                    </td>

                    <td className="px-3 py-3 text-center">
                      <div className="font-bold text-emerald-400">
                        {item.available_quantity}
                      </div>
                      {isLowStock && (
                        <span className="inline-flex items-center gap-0.5 text-[9px] font-bold uppercase text-yellow-400">
                          <AlertTriangle className="w-2.5 h-2.5" /> Low
                        </span>
                      )}
                    </td>

                    <td className="px-3 py-3 text-center font-semibold text-blue-400">
                      {item.reserved_quantity}
                    </td>

                    <td className="px-3 py-3 text-center text-gray-300">
                      {item.issued_quantity}
                    </td>

                    <td className="px-3 py-3 text-center font-semibold text-yellow-400">
                      {item.damaged_quantity}
                    </td>

                    {/* Status */}
                    <td className="px-3 py-3">
                      {item.is_active ? (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-emerald-500/10 text-emerald-400 border border-emerald-500/30">
                          Active
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 bg-white/5 text-gray-500 border border-white/10">
                          Inactive
                        </span>
                      )}
                    </td>

                    {/* Row Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => setAdjustingItem(item)}
                          className="bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors inline-flex items-center gap-1"
                        >
                          <SlidersHorizontal className="w-3 h-3 text-red" />
                          Adjust
                        </button>

                        <button
                          onClick={() => toggleItemActive(item)}
                          className={`border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider transition-colors ${
                            item.is_active
                              ? "border-red/30 text-red/80 hover:bg-red/10"
                              : "border-white/20 text-gray-400 hover:text-white"
                          }`}
                        >
                          {item.is_active ? "Deactivate" : "Reactivate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modals */}
      {isAddItemOpen && (
        <AddItemModal
          isLead={true}
          onClose={() => setIsAddItemOpen(false)}
          onSuccess={() => fetchItems()}
        />
      )}

      {isCategoriesOpen && (
        <ManageCategoriesModal
          onClose={() => setIsCategoriesOpen(false)}
          onChanged={() => {
            fetchCategories();
            fetchItems();
          }}
        />
      )}

      {adjustingItem && (
        <AdjustStockModal
          item={adjustingItem}
          onClose={() => setAdjustingItem(null)}
          onSuccess={() => fetchItems()}
        />
      )}
    </div>
  );
}
