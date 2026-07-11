"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import type { GalleryPhoto } from "@/components/ui/expandable-gallery";

const STACK_OFFSETS = [
  { rotation: -8, x: -14, y: 6, zIndex: 10 },
  { rotation: 0, x: 0, y: -6, zIndex: 20 },
  { rotation: 8, x: 14, y: 6, zIndex: 30 },
] as const;

export interface Album {
  id: string;
  title: string;
  photos: GalleryPhoto[];
}

export default function AlbumCard({
  album,
  onClick,
}: {
  album: Album;
  onClick: () => void;
}) {
  const stack = album.photos.slice(0, 3);

  return (
    <button
      type="button"
      onClick={onClick}
      className="group flex flex-col items-center gap-4 pt-4 pb-2 focus:outline-none"
    >
      <div className="relative h-48 w-48 md:h-56 md:w-56">
        {stack.map((photo, index) => {
          const offset = STACK_OFFSETS[index];
          return (
            <motion.div
              key={photo.id}
              className="absolute inset-6 rounded-[2rem] overflow-hidden border-4 border-black bg-white/5 shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
              style={{ zIndex: offset.zIndex }}
              initial={false}
              animate={{
                rotate: offset.rotation,
                x: offset.x,
                y: offset.y,
              }}
              whileHover={{
                scale: 1.06,
                y: offset.y - 10,
                rotate: offset.rotation * 0.7,
                zIndex: 50,
              }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
            >
              <Image
                src={photo.src}
                alt={photo.alt}
                fill
                className="object-cover select-none pointer-events-none"
                sizes="200px"
              />
            </motion.div>
          );
        })}
      </div>

      <div className="text-center">
        <h3 className="text-lg font-semibold text-white group-hover:text-red transition-colors">
          {album.title}
        </h3>
        <p className="text-sm text-white/50">
          {album.photos.length} photo{album.photos.length === 1 ? "" : "s"}
        </p>
      </div>
    </button>
  );
}
