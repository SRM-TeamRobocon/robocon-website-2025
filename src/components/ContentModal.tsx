"use client";

import { useEffect, useRef } from "react";
import Image from "next/image";
import Masonry, { ResponsiveMasonry } from "react-responsive-masonry";
import { X } from "lucide-react";
import type { ContentCardItem } from "./ContentGrid";

export default function ContentModal({ item, onClose }: { item: ContentCardItem | null; onClose: () => void }) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!item) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    document.body.style.overflow = "hidden";

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
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
  }, [item, onClose]);

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="content-modal-title"
        className="relative max-h-[85vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-white/10 bg-gray-950 shadow-2xl"
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

        <div className="relative aspect-video w-full bg-white/5">
          <Image
            src={item.coverImage}
            alt={item.name}
            fill
            unoptimized
            priority
            sizes="(max-width: 768px) 100vw, 768px"
            className="object-cover"
          />
        </div>

        <div className="space-y-4 p-6">
          <h2 id="content-modal-title" className="text-2xl font-bold text-white">
            {item.name}
          </h2>

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

          {item.gallery.length > 0 && (
            <ResponsiveMasonry columnsCountBreakPoints={{ 350: 1, 640: 2, 900: 3 }}>
              <Masonry gutter="8px">
                {item.gallery.map((src, index) => (
                  <Image
                    key={`${src}-${index}`}
                    src={src}
                    alt={`${item.name} gallery ${index + 1}`}
                    width={800}
                    height={800}
                    unoptimized
                    className="w-full rounded-lg"
                  />
                ))}
              </Masonry>
            </ResponsiveMasonry>
          )}
        </div>
      </div>
    </div>
  );
}
