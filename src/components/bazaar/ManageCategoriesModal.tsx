"use client";

import React, { useState, useEffect } from "react";
import { X, Plus, Trash2, Edit2, Check } from "lucide-react";
import toast from "react-hot-toast";
import { BazaarCategory } from "@/lib/bazaar/types";

interface ManageCategoriesModalProps {
  onClose: () => void;
  onChanged?: () => void;
}

export function ManageCategoriesModal({ onClose, onChanged }: ManageCategoriesModalProps) {
  const [categories, setCategories] = useState<BazaarCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  const loadCategories = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/bazaar/manage/categories");
      const data = await res.json();
      if (data.categories) setCategories(data.categories);
    } catch {
      toast.error("Failed to load categories");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newName.trim()) return;

    try {
      const res = await fetch("/api/bazaar/manage/categories", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.category) {
        setCategories((prev) => [...prev, data.category]);
        setNewName("");
        toast.success("Category added");
        if (onChanged) onChanged();
      } else {
        toast.error(data.error?.message || "Failed to add category");
      }
    } catch {
      toast.error("Failed to add category");
    }
  };

  const handleRename = async (id: string) => {
    if (!editingName.trim()) return;

    try {
      const res = await fetch(`/api/bazaar/manage/categories/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: editingName.trim() }),
      });
      const data = await res.json();
      if (res.ok && data.category) {
        setCategories((prev) =>
          prev.map((c) => (c.id === id ? { ...c, name: data.category.name } : c))
        );
        setEditingId(null);
        toast.success("Category renamed");
        if (onChanged) onChanged();
      } else {
        toast.error(data.error?.message || "Failed to rename");
      }
    } catch {
      toast.error("Failed to rename category");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Delete category "${name}"? Items in this category will become uncategorized.`)) {
      return;
    }

    try {
      const res = await fetch(`/api/bazaar/manage/categories/${id}`, {
        method: "DELETE",
      });
      if (res.ok) {
        setCategories((prev) => prev.filter((c) => c.id !== id));
        toast.success("Category deleted");
        if (onChanged) onChanged();
      } else {
        const data = await res.json();
        toast.error(data.error?.message || "Failed to delete");
      }
    } catch {
      toast.error("Failed to delete category");
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
            Inventory Classification
          </span>
          <h3 className="text-base font-bold text-white uppercase tracking-wide">
            Manage Categories
          </h3>
        </div>

        {/* Add Category Form */}
        <form onSubmit={handleAdd} className="flex gap-2 mb-4">
          <input
            type="text"
            required
            placeholder="New category name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="flex-1 bg-black border border-white/10 text-white px-3 py-2 text-xs focus:border-red focus:outline-none placeholder:text-gray-600"
          />
          <button
            type="submit"
            className="bg-red hover:bg-red/80 text-white font-bold px-4 py-2 text-xs uppercase tracking-wider transition-colors inline-flex items-center gap-1 shrink-0"
          >
            <Plus className="w-3.5 h-3.5" /> Add
          </button>
        </form>

        {/* Categories List */}
        <div className="border border-white/10 divide-y divide-white/5 max-h-64 overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-xs text-gray-500">Loading categories...</div>
          ) : categories.length === 0 ? (
            <div className="p-4 text-center text-xs text-gray-500">No categories created yet.</div>
          ) : (
            categories.map((cat) => (
              <div
                key={cat.id}
                className="p-3 flex items-center justify-between gap-2 hover:bg-white/[0.02]"
              >
                {editingId === cat.id ? (
                  <div className="flex-1 flex gap-2">
                    <input
                      type="text"
                      value={editingName}
                      onChange={(e) => setEditingName(e.target.value)}
                      className="flex-1 bg-black border border-white/20 text-white px-2 py-1 text-xs focus:border-red focus:outline-none"
                    />
                    <button
                      onClick={() => handleRename(cat.id)}
                      className="p-1.5 bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30"
                      title="Save"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1.5 text-gray-400 hover:text-white"
                      title="Cancel"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <>
                    <span className="text-xs text-white font-medium">{cat.name}</span>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => {
                          setEditingId(cat.id);
                          setEditingName(cat.name);
                        }}
                        className="p-1.5 text-gray-400 hover:text-white transition-colors"
                        title="Rename"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(cat.id, cat.name)}
                        className="p-1.5 text-gray-400 hover:text-red transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </>
                )}
              </div>
            ))
          )}
        </div>

        <div className="mt-4 pt-3 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="border border-white/20 text-gray-300 hover:text-white px-4 py-2 text-xs font-semibold uppercase tracking-wider"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
