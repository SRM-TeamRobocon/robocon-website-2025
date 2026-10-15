"use client";

import React, { useState, useEffect, useCallback, Suspense } from "react";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { Search, MapPin, Package, Filter, CheckCircle, Plus, ClipboardList } from "lucide-react";
import { BazaarNav } from "@/components/bazaar/BazaarNav";
import { RequestModal } from "@/components/bazaar/RequestModal";
import { AddItemModal } from "@/components/bazaar/AddItemModal";
import { BazaarPublicItem, BazaarCategory } from "@/lib/bazaar/types";

function BrowseContent() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<BazaarPublicItem[]>([]);
  const [categories, setCategories] = useState<BazaarCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("");
  const [inStockOnly, setInStockOnly] = useState(false);

  // Modals
  const [requestItem, setRequestItem] = useState<BazaarPublicItem | null>(null);
  const [isTakeModalOpen, setIsTakeModalOpen] = useState(false);
  const [isAddItemOpen, setIsAddItemOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get("action") === "take") {
      setIsTakeModalOpen(true);
    }
  }, [searchParams]);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await fetch("/api/bazaar/categories");
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
      if (inStockOnly) params.set("inStock", "1");
      params.set("pageSize", "60");

      const res = await fetch(`/api/bazaar/items?${params.toString()}`);
      const data = await res.json();
      if (data.data) {
        setItems(data.data);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  }, [search, selectedCategory, inStockOnly]);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchItems();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchItems]);

  return (
    <div className="space-y-6">
      <BazaarNav
        onOpenAddItem={() => setIsAddItemOpen(true)}
        onOpenTakeComponent={() => setIsTakeModalOpen(true)}
      />

      {/* Fast Component Checkout Banner */}
      <div className="p-4 bg-gradient-to-r from-red/20 via-black to-neutral-900 border border-red/40 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-widest text-red">
            Lab Fast Checkout
          </span>
          <h3 className="text-sm font-bold text-white uppercase tracking-wider">
            Taking a component or need something not listed yet?
          </h3>
          <p className="text-xs text-gray-400">
            Log what you took or need immediately so leads can track it, even before it&apos;s cataloged.
          </p>
        </div>
        <button
          onClick={() => setIsTakeModalOpen(true)}
          className="bg-red hover:bg-red/80 text-white font-bold px-4 py-2 text-xs uppercase tracking-wider transition-colors inline-flex items-center gap-2 shrink-0 self-start sm:self-auto shadow-lg shadow-red/20"
        >
          <ClipboardList className="w-4 h-4" /> Log / Take Component
        </button>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-black border border-white/10 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
          {/* Search Bar */}
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search components by name, specs..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-neutral-900 border border-white/10 pl-9 pr-3 py-2 text-xs text-white placeholder:text-gray-500 focus:border-red focus:outline-none"
            />
          </div>

          {/* In-Stock Toggle */}
          <label className="flex items-center gap-2 text-xs text-gray-300 cursor-pointer select-none border border-white/10 px-3 py-2 bg-neutral-900 hover:border-white/20 transition-colors">
            <input
              type="checkbox"
              checked={inStockOnly}
              onChange={(e) => setInStockOnly(e.target.checked)}
              className="accent-red"
            />
            <span className="font-semibold uppercase tracking-wider text-[11px]">
              In Stock Only
            </span>
          </label>
        </div>

        {/* Category Chips */}
        {categories.length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1 border-t border-white/5">
            <button
              onClick={() => setSelectedCategory("")}
              className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider border transition-colors ${
                selectedCategory === ""
                  ? "bg-red text-white border-red"
                  : "bg-neutral-900 border-white/10 text-gray-400 hover:text-white"
              }`}
            >
              All
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(selectedCategory === cat.id ? "" : cat.id)}
                className={`px-2.5 py-1 text-[11px] font-bold uppercase tracking-wider border transition-colors ${
                  selectedCategory === cat.id
                    ? "bg-red text-white border-red"
                    : "bg-neutral-900 border-white/10 text-gray-400 hover:text-white"
                }`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Components Grid */}
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
            No Components Found
          </h3>
          <p className="text-xs text-gray-400 max-w-sm mx-auto">
            {search || selectedCategory || inStockOnly
              ? "Try adjusting your search filters or browse all categories."
              : "No components have been registered in the lab yet."}
          </p>
          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <button
              onClick={() => setIsTakeModalOpen(true)}
              className="bg-red hover:bg-red/80 text-white font-bold px-4 py-2 text-xs uppercase tracking-wider inline-flex items-center gap-1.5"
            >
              <ClipboardList className="w-3.5 h-3.5" /> Log Unlisted Take
            </button>
            <button
              onClick={() => setIsAddItemOpen(true)}
              className="border border-white/20 hover:border-white/40 text-gray-300 hover:text-white font-bold px-4 py-2 text-xs uppercase tracking-wider inline-flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> Register Component
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {items.map((item) => {
            const inStock = item.available_quantity > 0;
            return (
              <div
                key={item.id}
                className="bg-black border border-white/10 flex flex-col justify-between hover:border-white/30 transition-colors group"
              >
                {/* Photo & Badge */}
                <div>
                  <div className="h-44 bg-neutral-900 relative overflow-hidden border-b border-white/10 flex items-center justify-center">
                    {item.image_url ? (
                      <Image
                        src={item.image_url}
                        alt={item.name}
                        fill
                        className="object-cover group-hover:scale-105 transition-transform duration-300"
                        sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-1 text-gray-600">
                        <Package className="w-8 h-8" />
                        <span className="text-[10px] font-mono uppercase">No photo</span>
                      </div>
                    )}

                    {/* Stock pill */}
                    <div className="absolute top-2 right-2">
                      {inStock ? (
                        <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider">
                          {item.available_quantity} available
                        </span>
                      ) : (
                        <span className="bg-yellow-500/20 text-yellow-400 border border-yellow-500/40 text-[10px] font-bold px-2 py-0.5 uppercase tracking-wider">
                          0 in stock
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-4 space-y-2">
                    {item.category?.name && (
                      <span className="text-[10px] font-bold uppercase tracking-widest text-red">
                        {item.category.name}
                      </span>
                    )}
                    <h3 className="text-sm font-bold text-white line-clamp-2 leading-snug">
                      {item.name}
                    </h3>

                    {item.description && (
                      <p className="text-xs text-gray-400 line-clamp-2 leading-relaxed">
                        {item.description}
                      </p>
                    )}

                    {item.location && (
                      <div className="flex items-center gap-1.5 text-[11px] text-gray-500 pt-1">
                        <MapPin className="w-3 h-3 text-gray-400" />
                        <span className="truncate">{item.location}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Footer Action */}
                <div className="p-4 pt-0">
                  <button
                    onClick={() => setRequestItem(item)}
                    className={`w-full font-bold py-2 text-xs uppercase tracking-wider transition-colors ${
                      inStock
                        ? "bg-red hover:bg-red/80 text-white"
                        : "border border-yellow-500/40 bg-yellow-500/10 text-yellow-300 hover:bg-yellow-500/20"
                    }`}
                  >
                    {inStock ? "Request Item" : "Request Anyway (0 in stock)"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modals */}
      {(requestItem || isTakeModalOpen) && (
        <RequestModal
          item={requestItem}
          onClose={() => {
            setRequestItem(null);
            setIsTakeModalOpen(false);
          }}
          onSuccess={() => fetchItems()}
        />
      )}

      {isAddItemOpen && (
        <AddItemModal
          onClose={() => setIsAddItemOpen(false)}
          onSuccess={() => fetchItems()}
        />
      )}
    </div>
  );
}

export default function BazaarBrowsePage() {
  return (
    <Suspense
      fallback={
        <div className="p-16 border border-white/10 bg-black text-center space-y-2">
          <div className="w-6 h-6 border-2 border-red border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-xs uppercase tracking-widest text-gray-500 font-bold">
            Loading Bazaar...
          </p>
        </div>
      }
    >
      <BrowseContent />
    </Suspense>
  );
}
