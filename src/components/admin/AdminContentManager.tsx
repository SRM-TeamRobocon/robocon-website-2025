"use client";

import { useEffect, useMemo, useState } from "react";
import type { ContentField, ContentResourceConfig } from "@/lib/content-resources";
import { Search } from "lucide-react";
import {
  IMAGE_URL_FIELDS,
  IMAGE_ARRAY_FIELDS,
  uploadTarget,
  findImageField,
  uploadImageFile,
  Thumb,
  SingleImageField,
  MultiImageField,
} from "@/components/ContentImageFields";

type Row = Record<string, any>;

const EMPTY_ROW: Row = {};

function valueForInput(field: ContentField, row: Row) {
  const value = row[field.name];

  if (field.type === "tags") {
    return Array.isArray(value) ? value.join(", ") : value ?? "";
  }

  if (field.type === "datetime" && typeof value === "string") {
    return value.slice(0, 16);
  }

  return value ?? "";
}

export default function AdminContentManager({ config }: { config: ContentResourceConfig }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [activeRow, setActiveRow] = useState<Row>(EMPTY_ROW);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingField, setUploadingField] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [search, setSearch] = useState("");

  const editableFields = useMemo(
    () => config.fields.filter((field) => !field.readonly || field.name === "is_read"),
    [config.fields]
  );

  const rowImageField = useMemo(() => findImageField(config), [config]);

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
      const response = await fetch(`/api/admin/content/${config.table}`, { cache: "no-store" });
      const json = await response.json();

      if (!response.ok) throw new Error(json.error || "Failed to load content");

      setRows(json.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load content");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadRows();
    setActiveRow(EMPTY_ROW);
    setSearch("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.table]);

  function setField(name: string, value: unknown) {
    setActiveRow((row) => ({ ...row, [name]: value }));
  }

  async function uploadSingle(field: ContentField, file: File) {
    const target = uploadTarget(config.table, field.name);
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

  async function uploadMultiple(field: ContentField, files: FileList) {
    const target = uploadTarget(config.table, field.name);
    if (!target) return;

    setUploadingField(field.name);
    setError("");

    try {
      const uploaded = await Promise.all(Array.from(files).map((file) => uploadImageFile(file, target)));
      const current: string[] = Array.isArray(activeRow[field.name]) ? activeRow[field.name] : [];
      setField(field.name, [...current, ...uploaded]);
      setNotice("Upload complete. Save the form to keep these images.");
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
      const response = await fetch(`/api/admin/content/${config.table}`, {
        method: activeRow.id ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(activeRow),
      });
      const json = await response.json();

      if (!response.ok) throw new Error(json.error || "Save failed");

      setNotice(`${config.label} saved`);
      setActiveRow(EMPTY_ROW);
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function makeMentor(row: Row) {
    if (!row.id || !window.confirm(`Move "${row.name}" to Mentors? They'll drop off the Members list.`)) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/admin/content/${config.table}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: row.id, domain: "MENTORS" }),
      });
      const json = await response.json();

      if (!response.ok) throw new Error(json.error || "Failed to move to Mentors");

      setNotice(`${row.name} moved to Mentors`);
      if (activeRow.id === row.id) setActiveRow(EMPTY_ROW);
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to move to Mentors");
    } finally {
      setSaving(false);
    }
  }

  async function deleteRow(row: Row) {
    if (!row.id || !window.confirm(`Delete this ${config.label.toLowerCase()}?`)) return;

    setSaving(true);
    setError("");
    setNotice("");

    try {
      const response = await fetch(`/api/admin/content/${config.table}?id=${encodeURIComponent(row.id)}`, {
        method: "DELETE",
      });
      const json = await response.json();

      if (!response.ok) throw new Error(json.error || "Delete failed");

      setNotice(`${config.label} deleted`);
      if (activeRow.id === row.id) setActiveRow(EMPTY_ROW);
      await loadRows();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-red">{config.pluralLabel}</p>
          <h1 className="text-4xl font-black text-white">Content Manager</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-400">
            Manage Supabase-backed content. Changes are saved through protected admin API routes.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setActiveRow(EMPTY_ROW)}
          className="bg-white px-4 py-2 text-sm font-bold text-black transition hover:bg-gray-200"
        >
          New {config.label}
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
              {config.pluralLabel} <span className="text-sm font-normal text-gray-500">({filteredRows.length})</span>
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
              <div className="p-5 text-gray-400">{rows.length === 0 ? "No rows yet." : "No matches."}</div>
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
                      {rowImageField && <Thumb src={row[rowImageField.name]} alt={row[config.primaryField] || "preview"} />}
                      <div className="min-w-0">
                        <h3 className="truncate font-bold text-white">
                          {row[config.primaryField] || row.caption || row.email || "Untitled"}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-sm text-gray-400">
                          {row.description || row.message || row.role || row.company || row.location || row.category || row.id}
                        </p>
                      </div>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      {config.table === "members" && (
                        <button
                          type="button"
                          onClick={() => makeMentor(row)}
                          className="border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm font-semibold text-emerald-100 transition hover:bg-emerald-500/20"
                        >
                          Make Mentor
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setActiveRow(row)}
                        className={`border px-3 py-2 text-sm text-white transition hover:bg-white/10 ${
                          isActive ? "border-red/60" : "border-white/10"
                        }`}
                      >
                        Edit
                      </button>
                      {!config.readonly && (
                        <button
                          type="button"
                          onClick={() => deleteRow(row)}
                          className="bg-red px-3 py-2 text-sm font-bold text-white transition hover:bg-red/80"
                        >
                          Delete
                        </button>
                      )}
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
          <h2 className="text-lg font-bold text-white">{activeRow.id ? `Edit ${config.label}` : `New ${config.label}`}</h2>
          <div className="mt-5 space-y-4">
            {editableFields.map((field) => {
              const upload = uploadTarget(config.table, field.name);
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

              if (IMAGE_ARRAY_FIELDS.has(field.name) && upload) {
                const values: string[] = Array.isArray(activeRow[field.name]) ? activeRow[field.name] : [];
                return (
                  <label key={field.name} className="block text-sm font-medium text-gray-300">
                    {field.label}
                    <MultiImageField
                      field={field}
                      values={values}
                      onChange={(next) => setField(field.name, next)}
                      onUploadFiles={(files) => uploadMultiple(field, files)}
                      uploading={uploadingField === field.name}
                    />
                  </label>
                );
              }

              return (
                <label key={field.name} className="block text-sm font-medium text-gray-300">
                  {field.label}
                  {field.type === "textarea" ? (
                    <textarea
                      required={field.required}
                      value={value}
                      onChange={(event) => setField(field.name, event.target.value)}
                      rows={4}
                      className="mt-2 block w-full border border-white/10 bg-white/5 px-3 py-2 text-white outline-none transition focus:border-red"
                    />
                  ) : (
                    <input
                      type={field.type === "datetime" ? "datetime-local" : field.type === "tags" ? "text" : field.type}
                      required={field.required}
                      value={value}
                      onChange={(event) => setField(field.name, event.target.value)}
                      placeholder={field.type === "tags" ? "Comma-separated values" : undefined}
                      className="mt-2 block w-full border border-white/10 bg-white/5 px-3 py-2 text-white outline-none transition focus:border-red"
                    />
                  )}
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
