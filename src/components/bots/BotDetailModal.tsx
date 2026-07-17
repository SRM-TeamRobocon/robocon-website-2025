"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import Masonry, { ResponsiveMasonry } from "react-responsive-masonry";
import { motion } from "framer-motion";
import { X, RotateCw } from "lucide-react";
import type { ContentCardItem } from "@/components/ContentGrid";

const BotViewer = dynamic(() => import("./BotViewer"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full w-full items-center justify-center">
      <p className="text-sm text-white/50">Loading viewer...</p>
    </div>
  ),
});

export default function BotDetailModal({
  item,
  onClose,
}: {
  item: ContentCardItem | null;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const hasModel = Boolean(item?.modelUrl);
  const hasGallery = Boolean(item && item.gallery.length > 0);

  const [activeTab, setActiveTab] = useState<"model" | "gallery">(hasModel ? "model" : "gallery");
  const [autoRotate, setAutoRotate] = useState(true);
  const [viewerKey, setViewerKey] = useState(0);
  const [modelFailed, setModelFailed] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  useEffect(() => {
    if (!item) return;
    setActiveTab(item.modelUrl ? "model" : "gallery");
    setModelFailed(false);
    setViewerKey((k) => k + 1);
  }, [item]);

  useEffect(() => {
    if (!item) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (lightbox) {
          setLightbox(null);
        } else {
          onClose();
        }
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;

      const focusable = panelRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      );
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
      previouslyFocused?.focus();
    };
  }, [item, onClose, lightbox]);

  if (!item) return null;

  const showModelTab = hasModel && !modelFailed;
  const showTabs = showModelTab && hasGallery;
  const effectiveTab = showModelTab ? activeTab : "gallery";

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bot-modal-title"
        initial={{ opacity: 0, scale: 0.96 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl border border-white/10 bg-gray-950 shadow-2xl"
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 rounded-full bg-black/60 p-2 text-white transition hover:bg-red"
        >
          <X size={18} />
        </button>

        <div className="flex items-center justify-between gap-4 border-b border-white/10 p-6 pr-16">
          <h2 id="bot-modal-title" className="text-2xl font-bold text-white">
            {item.name}
          </h2>

          {showTabs && (
            <div className="flex flex-shrink-0 gap-2">
              {(["model", "gallery"] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setActiveTab(tab)}
                  className={`rounded-md border px-4 py-1.5 text-sm font-medium transition ${
                    effectiveTab === tab
                      ? "border-red bg-red text-white"
                      : "border-white/10 bg-white/5 text-white/70 hover:bg-white/10"
                  }`}
                >
                  {tab === "model" ? "3D Model" : "Gallery"}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto">
          {effectiveTab === "model" && item.modelUrl ? (
            <div className="flex h-full flex-col">
              <div className="sharp-card relative h-[50vh] min-h-[320px] w-full">
                <BotViewer
                  key={viewerKey}
                  url={item.modelUrl}
                  autoRotate={autoRotate}
                  hotspots={item.hotspots}
                  onError={() => setModelFailed(true)}
                />
              </div>
              <div className="flex items-center justify-between gap-3 p-4">
                <button
                  type="button"
                  onClick={() => setAutoRotate((v) => !v)}
                  className="rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/10"
                >
                  {autoRotate ? "Pause rotation" : "Auto-rotate"}
                </button>
                <button
                  type="button"
                  onClick={() => setViewerKey((k) => k + 1)}
                  className="flex items-center gap-1.5 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition hover:bg-white/10"
                >
                  <RotateCw size={12} />
                  Reset view
                </button>
              </div>
              {item.abstract && (
                <p className="mx-4 mb-4 rounded-xl border border-red/20 bg-red/10 p-4 text-sm text-white/90">
                  {item.abstract}
                </p>
              )}
            </div>
          ) : (
            <div className="space-y-4 p-6">
              {hasModel && modelFailed && (
                <p className="rounded-xl border border-red/20 bg-red/10 p-4 text-sm text-white/80">
                  Couldn&apos;t load the 3D model — showing the gallery instead.
                </p>
              )}

              {item.badges && item.badges.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {item.badges.map((badge) => (
                    <span key={badge} className="rounded-full bg-red/15 px-2.5 py-1 text-xs font-medium text-red">
                      {badge}
                    </span>
                  ))}
                </div>
              )}

              {item.abstract && (
                <p className="rounded-xl border border-red/20 bg-red/10 p-4 text-sm text-white/90">{item.abstract}</p>
              )}

              {item.description && (
                <p className="whitespace-pre-line text-sm leading-relaxed text-white/70">{item.description}</p>
              )}

              {item.gallery.length > 0 ? (
                <ResponsiveMasonry columnsCountBreakPoints={{ 350: 1, 640: 2, 900: 3 }}>
                  <Masonry gutter="8px">
                    {item.gallery.map((src, index) => (
                      <button
                        key={`${src}-${index}`}
                        type="button"
                        onClick={() => setLightbox(src)}
                        aria-label={`Enlarge ${item.name} gallery image ${index + 1}`}
                        className="block w-full cursor-zoom-in"
                      >
                        <Image
                          src={src}
                          alt={`${item.name} gallery ${index + 1}`}
                          width={800}
                          height={800}
                          unoptimized
                          className="w-full rounded-lg transition duration-200 hover:opacity-80"
                        />
                      </button>
                    ))}
                  </Masonry>
                </ResponsiveMasonry>
              ) : (
                <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-white/5">
                  <Image src={item.coverImage} alt={item.name} fill unoptimized className="object-cover" />
                </div>
              )}
            </div>
          )}
        </div>
      </motion.div>

      {lightbox && (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
          onClick={(event) => {
            if (event.target === event.currentTarget) setLightbox(null);
          }}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Close enlarged image"
            className="absolute right-4 top-4 z-10 rounded-full bg-black/60 p-2 text-white transition hover:bg-red"
          >
            <X size={18} />
          </button>
          <div className="relative h-[85vh] w-full max-w-5xl">
            <Image src={lightbox} alt={`${item.name} enlarged`} fill unoptimized sizes="100vw" className="object-contain" />
          </div>
        </div>
      )}
    </div>
  );
}
