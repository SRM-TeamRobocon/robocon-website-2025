"use client";

import { useEffect, useMemo, useState } from "react";
import { FolderPlus, Pencil, Trash2, Upload, X, Images, ChevronLeft, ChevronRight } from "lucide-react";
import { Thumb, uploadImageFile } from "@/components/ContentImageFields";

interface Album {
  id: string;
  title: string;
  display_order: number;
  photo_count: number;
  cover_image_url: string | null;
}

interface Photo {
  id: string;
  album_id: string;
  image_url: string;
  title: string | null;
  display_order: number;
}

const UPLOAD_TARGET = { bucket: "gallery", folder: "gallery" };

export default function AdminGalleryManager({ role }: { role: "member" | "lead" | "admin" }) {
  const canManage = role !== "member";
  const [albums, setAlbums] = useState<Album[]>([]);
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAlbumId, setSelectedAlbumId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [creatingAlbum, setCreatingAlbum] = useState(false);
  const [newAlbumTitle, setNewAlbumTitle] = useState("");
  const [renamingAlbumId, setRenamingAlbumId] = useState<string | null>(null);
  const [renameTitle, setRenameTitle] = useState("");
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  async function loadAll() {
    setLoading(true);
    setError("");
    try {
      const [albumsRes, photosRes] = await Promise.all([
        fetch("/api/admin/gallery-albums", { cache: "no-store" }),
        fetch("/api/content/gallery", { cache: "no-store" }),
      ]);
      const albumsJson = await albumsRes.json();
      const photosJson = await photosRes.json();

      if (!albumsRes.ok || !albumsJson.success) throw new Error(albumsJson.error || "Failed to load albums");
      if (!photosRes.ok) throw new Error(photosJson.error || "Failed to load photos");

      setAlbums(albumsJson.data || []);
      setPhotos(photosJson.data || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load gallery");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAll();
  }, []);

  const selectedAlbum = albums.find((a) => a.id === selectedAlbumId) || null;
  const albumPhotos = useMemo(
    () => photos.filter((p) => p.album_id === selectedAlbumId),
    [photos, selectedAlbumId]
  );

  useEffect(() => {
    setLightboxIndex(null);
  }, [selectedAlbumId]);

  useEffect(() => {
    if (lightboxIndex !== null && lightboxIndex >= albumPhotos.length) {
      setLightboxIndex(albumPhotos.length > 0 ? albumPhotos.length - 1 : null);
    }
  }, [albumPhotos.length, lightboxIndex]);

  async function createAlbum(e: React.FormEvent) {
    e.preventDefault();
    if (!newAlbumTitle.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/gallery-albums", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newAlbumTitle.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Could not create album");

      setNewAlbumTitle("");
      setCreatingAlbum(false);
      setNotice(`Album "${json.data.title}" created`);
      await loadAll();
      setSelectedAlbumId(json.data.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create album");
    } finally {
      setBusy(false);
    }
  }

  async function renameAlbum(id: string) {
    if (!renameTitle.trim()) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/admin/gallery-albums", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, title: renameTitle.trim() }),
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Could not rename album");

      setRenamingAlbumId(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not rename album");
    } finally {
      setBusy(false);
    }
  }

  async function deleteAlbum(album: Album) {
    const warning =
      album.photo_count > 0
        ? `Delete "${album.title}" and its ${album.photo_count} photo${album.photo_count === 1 ? "" : "s"}? This cannot be undone.`
        : `Delete "${album.title}"?`;
    if (!window.confirm(warning)) return;

    setBusy(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/gallery-albums?id=${encodeURIComponent(album.id)}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok || !json.success) throw new Error(json.error || "Could not delete album");

      setNotice(`Album "${album.title}" deleted`);
      if (selectedAlbumId === album.id) setSelectedAlbumId(null);
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete album");
    } finally {
      setBusy(false);
    }
  }

  async function uploadPhotos(albumId: string, files: FileList) {
    setUploading(true);
    setError("");
    try {
      for (const file of Array.from(files)) {
        const publicUrl = await uploadImageFile(file, UPLOAD_TARGET);

        const res = canManage
          ? await fetch("/api/admin/gallery", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ album_id: albumId, image_url: publicUrl, title: "" }),
            })
          : await fetch("/api/member/content-edits", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                resource: "gallery",
                action: "create",
                payload: { album_id: albumId, image_url: publicUrl, title: "" },
              }),
            });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || "Could not save an uploaded photo");
      }
      setNotice(
        canManage
          ? `${files.length} photo${files.length === 1 ? "" : "s"} added`
          : `${files.length} photo${files.length === 1 ? "" : "s"} submitted for lead approval`
      );
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }

  async function updatePhoto(id: string, patch: Partial<Pick<Photo, "title" | "album_id">>) {
    setError("");
    try {
      const res = canManage
        ? await fetch("/api/admin/gallery", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ id, ...patch }),
          })
        : await fetch("/api/member/content-edits", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ resource: "gallery", action: "update", recordId: id, payload: patch }),
          });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not update photo");
      setNotice(canManage ? "Photo updated" : "Change submitted for lead approval");
      if (canManage) await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update photo");
    }
  }

  async function deletePhoto(photo: Photo) {
    if (!window.confirm("Delete this photo?")) return;
    setError("");
    try {
      const res = await fetch(`/api/admin/gallery?id=${encodeURIComponent(photo.id)}`, { method: "DELETE" });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || "Could not delete photo");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not delete photo");
    }
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-red">Gallery</p>
          <h1 className="text-4xl font-black text-white">Albums</h1>
          <p className="mt-2 max-w-2xl text-sm text-gray-400">
            {canManage
              ? "Create an album, then upload photos into it. Changes here go live on the public Gallery page immediately."
              : "Create albums directly. Photo adds and edits go to a lead for approval before going live."}
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreatingAlbum((v) => !v)}
          className="inline-flex items-center gap-2 bg-white px-4 py-2 text-sm font-bold text-black transition hover:bg-gray-200"
        >
          <FolderPlus size={16} />
          New Album
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

      {creatingAlbum && (
        <form onSubmit={createAlbum} className="flex gap-3 border border-white/10 bg-gray-950/70 p-4">
          <input
            autoFocus
            type="text"
            value={newAlbumTitle}
            onChange={(e) => setNewAlbumTitle(e.target.value)}
            placeholder="Album title, e.g. Robocon 2026 Finals"
            className="flex-1 border border-white/10 bg-white/5 px-3 py-2 text-white outline-none transition focus:border-red"
          />
          <button
            type="submit"
            disabled={busy || !newAlbumTitle.trim()}
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
            <span className="relative z-10 transition-colors duration-200 group-hover:text-black">Create</span>
          </button>
        </form>
      )}

      <div className="grid gap-8 lg:grid-cols-[340px_minmax(0,1fr)]">
        <section
          className="overflow-hidden border border-white/10 bg-gray-950/70"
          style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
        >
          <div className="border-b border-white/10 px-5 py-4">
            <h2 className="text-lg font-bold text-white">
              Albums <span className="text-sm font-normal text-gray-500">({albums.length})</span>
            </h2>
          </div>
          <div className="max-h-[70vh] divide-y divide-white/10 overflow-y-auto">
            {loading ? (
              <div className="p-5 text-gray-400">Loading...</div>
            ) : albums.length === 0 ? (
              <div className="p-5 text-center">
                <p className="text-gray-400">No albums yet.</p>
                <button
                  type="button"
                  onClick={() => setCreatingAlbum(true)}
                  className="mt-3 inline-flex items-center gap-2 bg-white px-4 py-2 text-sm font-bold text-black transition hover:bg-gray-200"
                >
                  <FolderPlus size={16} />
                  Create your first album
                </button>
              </div>
            ) : (
              albums.map((album) => (
                <button
                  key={album.id}
                  type="button"
                  onClick={() => setSelectedAlbumId(album.id)}
                  className={`flex w-full items-center gap-3 p-4 text-left transition-colors hover:bg-white/5 ${
                    album.id === selectedAlbumId ? "bg-red/10" : ""
                  }`}
                >
                  <Thumb src={album.cover_image_url} alt={album.title} size={48} />
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate font-bold text-white">{album.title}</h3>
                    <p className="text-sm text-gray-400">
                      {album.photo_count} photo{album.photo_count === 1 ? "" : "s"}
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </section>

        <section
          className="border border-white/10 bg-gray-950/70 p-5"
          style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
        >
          {!selectedAlbum ? (
            <div className="flex h-full flex-col items-center justify-center gap-2 py-16 text-center text-gray-500">
              <Images size={32} />
              <p>Pick an album to see and add its photos.</p>
            </div>
          ) : (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                {renamingAlbumId === selectedAlbum.id ? (
                  <div className="flex flex-1 gap-2">
                    <input
                      autoFocus
                      type="text"
                      value={renameTitle}
                      onChange={(e) => setRenameTitle(e.target.value)}
                      className="flex-1 border border-white/10 bg-white/5 px-3 py-1.5 text-white outline-none transition focus:border-red"
                    />
                    <button
                      type="button"
                      onClick={() => renameAlbum(selectedAlbum.id)}
                      disabled={busy}
                      className="group relative overflow-hidden bg-red px-8 py-1.5 text-sm font-bold text-white transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl hover:shadow-red/40 active:translate-y-0 active:scale-[0.97]"
                      style={{ clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)" }}
                    >
                      <span
                        className="absolute inset-0 -translate-x-full transition-transform duration-200 ease-out group-hover:translate-x-0"
                        style={{
                          clipPath: "polygon(8% 0%, 100% 0%, 92% 100%, 0% 100%)",
                          backgroundColor: "#D4AF37",
                        }}
                      />
                      <span className="relative z-10 transition-colors duration-200 group-hover:text-black">Save</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenamingAlbumId(null)}
                      className="border border-white/10 px-3 py-1.5 text-sm text-white transition hover:bg-white/10"
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <h2 className="flex items-center gap-2 text-xl font-bold text-white">
                    {selectedAlbum.title}
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => {
                          setRenamingAlbumId(selectedAlbum.id);
                          setRenameTitle(selectedAlbum.title);
                        }}
                        className="text-gray-500 transition hover:text-white"
                        aria-label="Rename album"
                      >
                        <Pencil size={15} />
                      </button>
                    )}
                  </h2>
                )}

                <div className="flex gap-2">
                  <label className="flex cursor-pointer items-center gap-2 bg-white px-4 py-2 text-sm font-bold text-black transition hover:bg-gray-200">
                    <Upload size={16} />
                    {uploading ? "Uploading..." : "Add Photos"}
                    <input
                      type="file"
                      accept="image/*"
                      multiple
                      disabled={uploading}
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.length) uploadPhotos(selectedAlbum.id, e.target.files);
                        e.target.value = "";
                      }}
                    />
                  </label>
                  {canManage && (
                    <button
                      type="button"
                      onClick={() => deleteAlbum(selectedAlbum)}
                      className="inline-flex items-center gap-2 bg-red-500/15 px-3 py-2 text-sm font-semibold text-red-400 ring-1 ring-inset ring-red-500/30 transition hover:bg-red-500/25"
                    >
                      <Trash2 size={15} />
                      Delete Album
                    </button>
                  )}
                </div>
              </div>

              {albumPhotos.length === 0 ? (
                <div className="border border-dashed border-white/10 p-10 text-center text-gray-500">
                  No photos in this album yet — add some above.
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 xl:grid-cols-4">
                  {albumPhotos.map((photo, index) => (
                    <PhotoCard
                      key={photo.id}
                      photo={photo}
                      albums={albums}
                      canDelete={canManage}
                      onOpen={() => setLightboxIndex(index)}
                      onSave={(patch) => updatePhoto(photo.id, patch)}
                      onDelete={() => deletePhoto(photo)}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      </div>

      {lightboxIndex !== null && albumPhotos[lightboxIndex] && (
        <Lightbox
          photo={albumPhotos[lightboxIndex]}
          hasPrev={lightboxIndex > 0}
          hasNext={lightboxIndex < albumPhotos.length - 1}
          onPrev={() => setLightboxIndex((i) => (i !== null ? i - 1 : i))}
          onNext={() => setLightboxIndex((i) => (i !== null ? i + 1 : i))}
          onClose={() => setLightboxIndex(null)}
        />
      )}
    </div>
  );
}

function Lightbox({
  photo,
  hasPrev,
  hasNext,
  onPrev,
  onNext,
  onClose,
}: {
  photo: Photo;
  hasPrev: boolean;
  hasNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev) onPrev();
      if (e.key === "ArrowRight" && hasNext) onNext();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [hasPrev, hasNext, onPrev, onNext, onClose]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 sm:p-10"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        className="absolute right-4 top-4 bg-white/10 p-2 text-white transition hover:bg-white/20"
        aria-label="Close"
      >
        <X size={20} />
      </button>

      {hasPrev && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onPrev();
          }}
          className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/10 p-2 text-white transition hover:bg-white/20 sm:left-6"
          aria-label="Previous photo"
        >
          <ChevronLeft size={24} />
        </button>
      )}

      {hasNext && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onNext();
          }}
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/10 p-2 text-white transition hover:bg-white/20 sm:right-6"
          aria-label="Next photo"
        >
          <ChevronRight size={24} />
        </button>
      )}

      <div className="flex max-h-full max-w-full flex-col items-center gap-3" onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.image_url}
          alt={photo.title || "photo"}
          className="max-h-[85vh] max-w-full object-contain"
        />
        {photo.title && <p className="text-sm text-white/80">{photo.title}</p>}
      </div>
    </div>
  );
}

function PhotoCard({
  photo,
  albums,
  canDelete,
  onOpen,
  onSave,
  onDelete,
}: {
  photo: Photo;
  albums: Album[];
  canDelete: boolean;
  onOpen: () => void;
  onSave: (patch: Partial<Pick<Photo, "title" | "album_id">>) => void;
  onDelete: () => void;
}) {
  const [caption, setCaption] = useState(photo.title ?? "");
  const [albumChoice, setAlbumChoice] = useState(photo.album_id);

  // Re-sync when the server's copy of this photo actually changes (e.g. a lead's edit
  // lands). A member's own pending proposal never changes it, so their choice sticks.
  useEffect(() => {
    setCaption(photo.title ?? "");
    setAlbumChoice(photo.album_id);
  }, [photo.title, photo.album_id]);

  return (
    <div
      className="group relative overflow-hidden border border-white/10 bg-white/5"
      style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" }}
    >
      <div className="relative aspect-square w-full overflow-hidden bg-white/5">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photo.image_url}
          alt={photo.title || "photo"}
          onClick={onOpen}
          className="absolute inset-0 h-full w-full cursor-zoom-in object-cover transition duration-200 group-hover:scale-105"
        />
        {canDelete && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="absolute right-2 top-2 bg-black/70 p-1.5 text-white opacity-0 transition group-hover:opacity-100"
            aria-label="Delete photo"
          >
            <X size={14} />
          </button>
        )}
      </div>
      <div className="space-y-2 p-2.5">
        <input
          type="text"
          value={caption}
          onChange={(e) => setCaption(e.target.value)}
          onBlur={() => {
            if (caption !== (photo.title ?? "")) onSave({ title: caption });
          }}
          placeholder="Caption"
          className="w-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none transition focus:border-red"
        />
        <select
          value={albumChoice}
          onChange={(e) => {
            setAlbumChoice(e.target.value);
            onSave({ album_id: e.target.value });
          }}
          className="w-full border border-white/10 bg-white/5 px-2 py-1 text-xs text-white outline-none transition focus:border-red"
        >
          {albums.map((album) => (
            <option key={album.id} value={album.id} className="bg-gray-900">
              {album.title}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
