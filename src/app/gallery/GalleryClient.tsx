"use client";

import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import ExpandableGallery from "@/components/ui/expandable-gallery";
import AlbumCard, { type Album } from "./AlbumCard";

export default function GalleryClient({ albums }: { albums: Album[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = albums.find((album) => album.id === selectedId) || null;

  return (
    <AnimatePresence mode="wait">
      {selected ? (
        <motion.div
          key="album-detail"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <ExpandableGallery
            photos={selected.photos}
            title={selected.title}
            defaultExpanded
            onBack={() => setSelectedId(null)}
          />
        </motion.div>
      ) : (
        <motion.div
          key="album-grid"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-x-4 gap-y-10 px-4 md:px-8 max-w-6xl mx-auto pb-24"
        >
          {albums.map((album) => (
            <AlbumCard
              key={album.id}
              album={album}
              onClick={() => setSelectedId(album.id)}
            />
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
