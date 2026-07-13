"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { Play, Shuffle, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Album } from "./AlbumCard";
import type { GalleryPhoto } from "@/components/ui/expandable-gallery";
import Player from "./Player";

const PROGRESS_KEY = "gallery:progress";
const HERO_ROTATE_MS = 6000;
const HOVER_PREVIEW_MS = 700;
const EDGE_FADE_MASK =
  "linear-gradient(to right, transparent, black 24px, black calc(100% - 24px), transparent)";

type ProgressMap = Record<string, { index: number; ts: number }>;

function readProgress(): ProgressMap {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");
  } catch {
    return {};
  }
}

function writeProgress(albumId: string, index: number): ProgressMap {
  const next = { ...readProgress(), [albumId]: { index, ts: Date.now() } };
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(next));
  return next;
}

function shuffle(photos: GalleryPhoto[]): GalleryPhoto[] {
  const copy = [...photos];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

interface OpenPlayer {
  albumId: string;
  photos: GalleryPhoto[];
  title: string;
  initialIndex: number;
}

export default function GalleryClient({ albums }: { albums: Album[] }) {
  const [progress, setProgress] = useState<ProgressMap>({});
  const [showAll, setShowAll] = useState(false);
  const [open, setOpen] = useState<OpenPlayer | null>(null);
  const [heroIndex, setHeroIndex] = useState(0);
  const [heroPaused, setHeroPaused] = useState(false);

  useEffect(() => {
    setProgress(readProgress());
  }, []);

  const heroAlbums = useMemo(() => albums.slice(0, 5), [albums]);

  useEffect(() => {
    if (heroAlbums.length <= 1 || heroPaused) return;
    const id = setInterval(() => {
      setHeroIndex((i) => (i + 1) % heroAlbums.length);
    }, HERO_ROTATE_MS);
    return () => clearInterval(id);
  }, [heroAlbums.length, heroPaused]);

  if (albums.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 py-24 text-center px-4">
        <p className="text-lg font-medium text-white/80">No albums yet</p>
        <p className="text-sm text-white/50">
          Check back soon — we&apos;re still uploading photos.
        </p>
      </div>
    );
  }

  const hero = heroAlbums[heroIndex] ?? albums[0];
  const continueViewing = Object.entries(progress)
    .map(([albumId, entry]) => ({ album: albums.find((a) => a.id === albumId), ...entry }))
    .filter(
      (item): item is { album: Album; index: number; ts: number } =>
        !!item.album && item.index < item.album.photos.length - 1
    )
    .sort((a, b) => b.ts - a.ts);

  const closePlayer = (lastIndex: number) => {
    if (open) setProgress(writeProgress(open.albumId, lastIndex));
    setOpen(null);
  };

  return (
    <div className="pb-24">
      {/* hero */}
      <section className="px-4 md:px-8 max-w-6xl mx-auto mb-12">
        <div
          onMouseEnter={() => setHeroPaused(true)}
          onMouseLeave={() => setHeroPaused(false)}
          className="relative aspect-[16/9] md:aspect-[21/9] w-full overflow-hidden rounded-2xl bg-white/5"
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={hero.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.6 }}
              className="absolute inset-0"
            >
              {hero.photos[0] && (
                <motion.div
                  className="absolute inset-0"
                  animate={{ scale: [1, 1.06] }}
                  transition={{ duration: 10, repeat: Infinity, repeatType: "mirror", ease: "linear" }}
                >
                  <FadeImage
                    src={hero.photos[0].src}
                    alt={hero.photos[0].alt}
                    sizes="100vw"
                    priority
                    className="object-cover"
                  />
                </motion.div>
              )}
            </motion.div>
          </AnimatePresence>

          <div className="absolute inset-0 bg-gradient-to-t from-black via-black/40 to-transparent" />
          <div className="absolute inset-0 bg-gradient-to-r from-black/70 via-black/10 to-transparent" />

          <AnimatePresence mode="wait">
            <motion.div
              key={hero.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4, delay: 0.15 }}
              className="absolute inset-x-0 bottom-0 p-5 md:p-10 max-w-lg"
            >
            <span className="flex items-center gap-1.5 text-red text-xs md:text-sm font-bold tracking-widest uppercase mb-2">
              <span className="h-1.5 w-1.5 rounded-full bg-red" />
              Gallery
            </span>
            <h2 className="text-2xl md:text-4xl font-bold text-white mb-2">{hero.title}</h2>
            <p className="text-white/60 text-sm md:text-base mb-5">
              {hero.photos.length} photo{hero.photos.length === 1 ? "" : "s"}
            </p>
            <div className="flex items-center gap-3">
              <motion.button
                type="button"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() =>
                  setOpen({
                    albumId: hero.id,
                    photos: hero.photos,
                    title: hero.title,
                    initialIndex: progress[hero.id]?.index ?? 0,
                  })
                }
                className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 font-semibold text-black transition-colors hover:bg-white/90"
              >
                <Play size={18} fill="black" />
                Play
              </motion.button>
              <motion.button
                type="button"
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.96 }}
                onClick={() =>
                  setOpen({
                    albumId: hero.id,
                    photos: shuffle(hero.photos),
                    title: hero.title,
                    initialIndex: 0,
                  })
                }
                className="flex items-center gap-2 rounded-full bg-white/10 px-5 py-2.5 font-semibold text-white transition-colors hover:bg-white/20"
              >
                <Shuffle size={18} />
                Shuffle
              </motion.button>
            </div>
            </motion.div>
          </AnimatePresence>

          {heroAlbums.length > 1 && (
            <div className="absolute bottom-5 right-5 md:bottom-10 md:right-10 z-10 flex gap-1.5">
              {heroAlbums.map((a, i) => (
                <button
                  key={a.id}
                  type="button"
                  onClick={() => setHeroIndex(i)}
                  aria-label={`Show ${a.title}`}
                  className={cn(
                    "h-1.5 rounded-full transition-all",
                    i === heroIndex ? "w-6 bg-red" : "w-1.5 bg-white/40 hover:bg-white/60"
                  )}
                />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* all albums */}
      <div className="px-4 md:px-8 max-w-6xl mx-auto flex items-center justify-between mb-3">
        <h3 className="text-lg md:text-xl font-semibold text-white">All Albums</h3>
        <button
          type="button"
          onClick={() => setShowAll((prev) => !prev)}
          className="flex items-center gap-1 text-sm text-white/60 hover:text-white transition-colors"
        >
          {showAll ? "Show less" : "See all"}
          <ChevronRight size={16} className={showAll ? "rotate-90 transition-transform" : "transition-transform"} />
        </button>
      </div>

      {showAll ? (
        <div className="px-4 md:px-8 max-w-6xl mx-auto flex flex-col">
          {albums.map((album, i) => (
            <motion.button
              key={album.id}
              type="button"
              onClick={() =>
                setOpen({
                  albumId: album.id,
                  photos: album.photos,
                  title: album.title,
                  initialIndex: progress[album.id]?.index ?? 0,
                })
              }
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              whileHover={{ backgroundColor: "rgba(255,255,255,0.05)" }}
              whileTap={{ scale: 0.98 }}
              transition={{ delay: Math.min(i * 0.03, 0.3), duration: 0.25 }}
              className="group flex items-center gap-4 px-3 py-3 rounded-xl text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-red"
            >
              <span className="w-6 text-center text-sm text-white/40 group-hover:hidden shrink-0">
                {i + 1}
              </span>
              <Play size={16} className="hidden w-6 shrink-0 text-red group-hover:block" />
              <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-white/5">
                {album.photos[0] && (
                  <FadeImage src={album.photos[0].src} alt={album.photos[0].alt} sizes="56px" className="object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="truncate font-medium text-white group-hover:text-red transition-colors">
                  {album.title}
                </h3>
                <p className="text-sm text-white/50">
                  {album.photos.length} photo{album.photos.length === 1 ? "" : "s"}
                </p>
              </div>
            </motion.button>
          ))}
        </div>
      ) : (
        <Row title={null}>
          {albums.map((album, i) => (
            <Card
              key={album.id}
              index={i}
              title={album.title}
              subtitle={`${album.photos.length} photo${album.photos.length === 1 ? "" : "s"}`}
              photos={album.photos}
              onClick={() =>
                setOpen({
                  albumId: album.id,
                  photos: album.photos,
                  title: album.title,
                  initialIndex: progress[album.id]?.index ?? 0,
                })
              }
            />
          ))}
        </Row>
      )}

      {/* continue viewing */}
      {continueViewing.length > 0 && (
        <Row title="Continue Viewing">
          {continueViewing.map(({ album, index }, i) => {
            const photo = album.photos[index];
            const pct = ((index + 1) / album.photos.length) * 100;
            return (
              <Card
                key={album.id}
                index={i}
                title={album.title}
                subtitle={`${index + 1} / ${album.photos.length}`}
                photos={[photo]}
                onClick={() =>
                  setOpen({
                    albumId: album.id,
                    photos: album.photos,
                    title: album.title,
                    initialIndex: index,
                  })
                }
              >
                <div className="absolute bottom-0 left-0 z-10 h-1 w-full bg-white/20">
                  <div className="h-full bg-red" style={{ width: `${pct}%` }} />
                </div>
              </Card>
            );
          })}
        </Row>
      )}

      {open && (
        <Player
          photos={open.photos}
          title={open.title}
          initialIndex={open.initialIndex}
          onClose={closePlayer}
        />
      )}
    </div>
  );
}

function Row({ title, children }: { title: string | null; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      {title && (
        <motion.h3
          initial={{ opacity: 0, x: -12 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.6 }}
          transition={{ duration: 0.3 }}
          className="px-4 md:px-8 max-w-6xl mx-auto text-lg md:text-xl font-semibold text-white mb-3"
        >
          {title}
        </motion.h3>
      )}
      <div
        className="px-4 md:px-8 max-w-6xl mx-auto flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory"
        style={{ WebkitMaskImage: EDGE_FADE_MASK, maskImage: EDGE_FADE_MASK }}
      >
        {children}
      </div>
    </section>
  );
}

function Card({
  title,
  subtitle,
  photos,
  onClick,
  children,
  index = 0,
}: {
  title: string;
  subtitle: string;
  photos: GalleryPhoto[];
  onClick: () => void;
  children?: React.ReactNode;
  index?: number;
}) {
  const previewPhotos = photos.slice(0, 3);
  const [hoverIndex, setHoverIndex] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  }, []);

  const startHover = () => {
    if (previewPhotos.length <= 1) return;
    intervalRef.current = setInterval(() => {
      setHoverIndex((i) => (i + 1) % previewPhotos.length);
    }, HOVER_PREVIEW_MS);
  };

  const stopHover = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = null;
    setHoverIndex(0);
  };

  const activePhoto = previewPhotos[hoverIndex] || photos[0];

  return (
    <motion.button
      type="button"
      onClick={onClick}
      onMouseEnter={startHover}
      onMouseLeave={stopHover}
      initial={{ opacity: 0, y: 16 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      whileHover={{ scale: 1.08, y: -8, zIndex: 20 }}
      whileTap={{ scale: 0.97 }}
      transition={{ delay: Math.min(index * 0.05, 0.4), type: "spring", stiffness: 300, damping: 22 }}
      style={{ transformOrigin: "center" }}
      className="group relative w-40 md:w-48 shrink-0 snap-start rounded-xl overflow-hidden bg-white/5 shadow-lg"
    >
      <div className="relative aspect-[2/3] w-full">
        {activePhoto && (
          <AnimatePresence mode="wait">
            <motion.div
              key={activePhoto.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="absolute inset-0"
            >
              <FadeImage
                src={activePhoto.src}
                alt={activePhoto.alt}
                sizes="200px"
                className="object-cover"
              />
            </motion.div>
          </AnimatePresence>
        )}

        {/* base caption, fades out on hover */}
        <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/85 to-transparent px-2 pb-2 pt-6 transition-opacity duration-200 group-hover:opacity-0">
          <p className="truncate text-xs font-medium text-white/90">{title}</p>
        </div>

        {/* hover reveal: play button + full info */}
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/65 p-3 text-center opacity-0 transition-opacity duration-200 group-hover:opacity-100">
          <span className="flex h-10 w-10 scale-75 items-center justify-center rounded-full bg-white text-black opacity-0 shadow-lg transition-all duration-300 delay-75 group-hover:scale-100 group-hover:opacity-100">
            <Play size={16} fill="black" className="ml-0.5" />
          </span>
          <p className="w-full truncate text-sm font-semibold text-white">{title}</p>
          <p className="text-xs text-white/70">{subtitle}</p>
        </div>

        {children}
      </div>
    </motion.button>
  );
}

function FadeImage({
  src,
  alt,
  sizes,
  priority,
  className,
}: {
  src: string;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
}) {
  const [loaded, setLoaded] = useState(false);

  return (
    <>
      <div
        className={cn(
          "absolute inset-0 bg-white/5 transition-opacity duration-300",
          loaded ? "opacity-0" : "opacity-100 animate-pulse"
        )}
      />
      <Image
        src={src}
        alt={alt}
        fill
        sizes={sizes}
        priority={priority}
        onLoad={() => setLoaded(true)}
        className={cn(className, "transition-opacity duration-500", loaded ? "opacity-100" : "opacity-0")}
      />
    </>
  );
}
