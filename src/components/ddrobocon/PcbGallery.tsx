"use client";

import { useState } from "react";
import Image from "next/image";
import { X } from "lucide-react";
import ScrollReveal from "./ScrollReveal";
import TiltCard from "./TiltCard";
import type { PcbItem } from "@/data/ddRobocon";

export default function PcbGallery({ items }: { items: PcbItem[] }) {
  const [lightbox, setLightbox] = useState<PcbItem | null>(null);

  if (items.length === 0) {
    return (
      <ScrollReveal>
        <p className="py-10 text-center text-white/50">PCB designs coming soon.</p>
      </ScrollReveal>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((item, index) => (
          <ScrollReveal key={item.id} transition={{ duration: 0.5, ease: "easeOut", delay: Math.min(index, 6) * 0.08 }}>
            <TiltCard>
            <button
              type="button"
              onClick={() => setLightbox(item)}
              className="sharp-card group overflow-hidden rounded-2xl text-left"
            >
              <div className="relative aspect-[4/3] w-full bg-white/5">
                <Image
                  src={item.imageUrl}
                  alt={item.title}
                  fill
                  unoptimized
                  sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 33vw"
                  className="object-cover transition duration-300 group-hover:scale-105"
                />
              </div>
              <div className="p-4">
                <h3 className="font-bold text-white">{item.title}</h3>
                {item.description && <p className="mt-1 text-sm text-white/60">{item.description}</p>}
              </div>
            </button>
            </TiltCard>
          </ScrollReveal>
        ))}
      </div>

      {lightbox && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/85 p-4 backdrop-blur-md"
          onClick={(event) => {
            if (event.target === event.currentTarget) setLightbox(null);
          }}
        >
          <button
            type="button"
            onClick={() => setLightbox(null)}
            aria-label="Close"
            className="absolute right-4 top-4 z-10 rounded-full bg-black/60 p-2 text-white transition hover:bg-red"
          >
            <X size={18} />
          </button>
          <div className="relative h-[85vh] w-full max-w-4xl">
            <Image src={lightbox.imageUrl} alt={lightbox.title} fill unoptimized sizes="100vw" className="object-contain" />
          </div>
        </div>
      )}
    </>
  );
}
