"use client";

import { useEffect, useMemo, useState } from "react";
import type { ContentField } from "@/lib/content-resources";
import { GraduationCap, Search } from "lucide-react";
import {
  IMAGE_URL_FIELDS,
  uploadTarget,
  uploadImageFile,
  Thumb,
  SingleImageField,
} from "@/components/ContentImageFields";

type Row = Record<string, any>;

const EMPTY_ROW: Row = { is_active: true };

const MENTOR_FIELDS: ContentField[] = [
  { name: "name", label: "Name", type: "text", required: true },
  { name: "role", label: "Role / Designation", type: "text", required: true },
  { name: "year", label: "Last Year in Robocon (e.g. 2024)", type: "text" },
  { name: "photo_url", label: "Photo URL", type: "url" },
  { name: "linkedin_url", label: "LinkedIn URL", type: "url" },
  { name: "instagram_url", label: "Instagram URL", type: "url" },
  { name: "facebook_url", label: "Facebook URL", type: "url" },
  { name: "is_active", label: "Active", type: "boolean" },
  { name: "display_order", label: "Display Order", type: "number" },
];

function valueForInput(field: ContentField, row: Row) {
  return row[field.name] ?? "";
}

export default function AdminMentorManager() {
  const [rows, setRows] = useState<Row[]>([]);
  const [activeRow, setActiveRow] = useState<Row>(EMPTY_ROW);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [promotingId, setPromotingId] = useState<string | null>(null);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return rows;

    return rows.filter((row) =>
      Object.values(row).some((value) => typeof value === "string" && value.toLowerCase().includes(query))
    );
  }, [rows, search]);

  async function loadRows() {
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/admin/mentors", { cache: "no-store" });
      const json = await response.json();

      if (!response.ok) throw new Error(json.error || "Failed to load mentors");

      setRows(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load mentors");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows();
  }, []);

  function setField(name: string, value: unknown) {
    setActiveRow((row) => ({ ...row, [name]: value }));
  }

  async function uploadSingle(field: ContentField, file: File) {
    const target = uploadTarget("mentors", field.name);
    if (!target) return;

    setUploadingField(field.name);
    setError("");

    try {
      const publicUrl = await uploadImageFile(file, target);
      setField(field.name, publicUrl);
      setNotice("Upload complete. Save the form to keep this image.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingField(null);
    }
  }

  async function saveRow(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch("/api/admin/mentors", {
        method: activeRow.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(activeRow),
      });
      const json = await response.json();

      if (!response.ok) throw new Error(json.error || "Save failed");

      setNotice("Mentor saved");
      setActiveRow(EMPTY_ROW);
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(row: Row) {
    if (!row.id || !window.confirm(`Delete mentor "${row.name}"? This cannot be undone.`)) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/admin/mentors?id=${encodeURIComponent(row.id)}`, { method: "DELETE" });
      const json = await response.json();

      if (!response.ok) throw new Error(json.error || "Delete failed");

      setNotice("Mentor deleted");
      if (activeRow.id === row.id) setActiveRow(EMPTY_ROW);
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  async function promoteRow(row: Row) {
    if (!row.id) return;

    if (!String(row.year || "").trim()) {
      setError(`Set a Year on "${row.name}" before promoting to Alumni.`);
      return;
    }

    if (
      !window.confirm(
        `Move "${row.name}" to Alumni with batch "${row.year}"? They will be removed from the Mentors list.`
      )
    ) {
      return;
    }

    setPromotingId(row.id);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/admin/mentors/${row.id}/promote`, { method: "POST" });
      const json = await response.json();

      if (!response.ok) throw new Error(json.error || "Promotion failed");

      setNotice(`${row.name} moved to Alumni (batch ${row.year})`);
      if (activeRow.id === row.id) setActiveRow(EMPTY_ROW);
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Promotion failed");
    } finally {
      setPromotingId(null);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-red">Mentors</p>
          <h1 className="text-4xl font-black text-white">Mentor Manager</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-400">
            4th-year members who have moved on to mentor status. When it&apos;s time for them to graduate off the
            roster, use <span className="text-white">Make Alumni</span> to move them to the Alumni page under
            their profile&apos;s Year as the batch.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActiveRow(EMPTY_ROW)}
          className="bg-white px-4 py-2 text-sm font-bold text-black transition hover:bg-gray-200"
        >
          New Mentor
        </button>
      </div>

      {(error || notice) && (
        <div
          className={`border p-4 text-sm ${
            error ? "border-red-500/40 bg-red-500/10 text-red-100" : "border-emerald-500/40 bg-emerald-500/10 text-emerald-100"
          }`}
        >
          {error || notice}
        </div>
      )}

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_420px]">
        <section
          className="overflow-hidden border border-white/10 bg-gray-950/70"
          style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
        >
          <div className="flex flex-col gap-3 border-b border-white/10 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <h2 className="text-lg font-bold text-white">
              Mentors <span className="text-sm font-normal text-gray-500">({filteredRows.length})</span>
            </h2>
            <div className="relative">
              <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search..."
                className="w-full border border-white/10 bg-white/5 py-1.5 pl-8 pr-3 text-sm text-white outline-none transition focus:border-red sm:w-56"
              />
            </div>
          </div>
          <div className="max-h-[70vh] divide-y divide-white/10 overflow-y-auto">
            {loading ? (
              <div className="p-5 text-gray-400">Loading...</div>
            ) : filteredRows.length === 0 ? (
              <div className="p-5 text-gray-400">{rows.length === 0 ? "No mentors yet." : "No matches."}</div>
            ) : (
              filteredRows.map((row) => {
                const isActive = row.id && row.id === activeRow.id;
                return (
                  <article
                    key={row.id}
                    className={`flex flex-col gap-3 p-5 transition-colors md:flex-row md:items-center md:justify-between ${
                      isActive ? "bg-red/10" : ""
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <Thumb src={row.photo_url} alt={row.name || "preview"} />
                      <div className="min-w-0">
                        <h3 className="truncate font-bold text-white">{row.name || "Untitled"}</h3>
                        <p className="mt-1 line-clamp-2 text-sm text-gray-400">
                          {row.role}
                          {row.year ? ` · ${row.year}` : ""}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <button
                        type="button"
                        onClick={() => promoteRow(row)}
                        disabled={promotingId === row.id}
                        title={row.year ? undefined : "Set a Year first"}
                        className="flex items-center gap-1.5 border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <GraduationCap size={14} />
                        {promotingId === row.id ? "Moving..." : "Make Alumni"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setActiveRow(row)}
                        className={`border px-3 py-2 text-sm text-white transition hover:bg-white/10 ${
                          isActive ? "border-red/60" : "border-white/10"
                        }`}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteRow(row)}
                        className="bg-red px-3 py-2 text-sm font-bold text-white transition hover:bg-red/80"
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </div>
        </section>

        <form
          onSubmit={saveRow}
          className="h-fit border border-white/10 bg-gray-950/70 p-5"
          style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
        >
          <h2 className="text-lg font-bold text-white">{activeRow.id ? "Edit Mentor" : "New Mentor"}</h2>
          <div className="mt-5 space-y-4">
            {MENTOR_FIELDS.map((field) => {
              const upload = uploadTarget("mentors", field.name);
              const value = valueForInput(field, activeRow);

              if (field.type === "boolean") {
                return (
                  <label key={field.name} className="flex items-center gap-3 border border-white/10 bg-white/5 p-3 text-sm text-white">
                    <input
                      type="checkbox"
                      checked={Boolean(activeRow[field.name])}
                      onChange={(event) => setField(field.name, event.target.checked)}
                      className="h-4 w-4"
                    />
                    {field.label}
                  </label>
                );
              }

              if (IMAGE_URL_FIELDS.has(field.name) && upload) {
                return (
                  <label key={field.name} className="block text-sm font-medium text-gray-300">
                    {field.label}
                    <SingleImageField
                      field={field}
                      value={value}
                      onChange={(next) => setField(field.name, next)}
                      onUpload={(file) => uploadSingle(field, file)}
                      uploading={uploadingField === field.name}
                    />
                  </label>
                );
              }

              if (field.name === "year") {
                return (
                  <label key={field.name} className="block text-sm font-medium text-gray-300">
                    {field.label}
                    <input
                      type="text"
                      inputMode="numeric"
                      pattern="\d{4}"
                      maxLength={4}
                      placeholder="2024"
                      value={value}
                      onChange={(event) => setField(field.name, event.target.value.replace(/\D/g, "").slice(0, 4))}
                      className="mt-2 block w-full border border-white/10 bg-white/5 px-3 py-2 text-white outline-none transition focus:border-red"
                    />
                  </label>
                );
              }

              return (
                <label key={field.name} className="block text-sm font-medium text-gray-300">
                  {field.label}
                  <input
                    type={field.type === "number" ? "number" : field.type}
                    required={field.required}
                    value={value}
                    onChange={(event) => setField(field.name, event.target.value)}
                    className="mt-2 block w-full border border-white/10 bg-white/5 px-3 py-2 text-white outline-none transition focus:border-red"
                  />
                </label>
              );
            })}
          </div>
          <div className="mt-6 flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="group relative overflow-hidden bg-red px-8 py-2 text-sm font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-red/40 active:translate-y-0 active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-60"
              style={{ clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)" }}
            >
              <span
                className="absolute inset-0 -translate-x-full transition-transform duration-200 ease-out group-hover:translate-x-0"
                style={{
                  clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)",
                  backgroundColor: "#D4AF37",
                }}
              />
              <span className="relative z-10 transition-colors duration-200 group-hover:text-black">
                {saving ? "Saving..." : "Save"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => setActiveRow(EMPTY_ROW)}
              className="border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10"
            >
              Clear
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
