"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, type PanInfo } from "framer-motion";
import Image from "next/image";
import { X, ChevronLeft, ChevronRight, Play, Pause } from "lucide-react";
import { cn } from "@/lib/utils";
import type { GalleryPhoto } from "@/components/ui/expandable-gallery";

const AUTOPLAY_INTERVAL_MS = 3500;
const SWIPE_THRESHOLD_PX = 80;
const SWIPE_VELOCITY_THRESHOLD = 500;

const slideVariants = {
  enter: (direction: number) => ({
    x: direction > 0 ? "100%" : "-100%",
    opacity: 0,
  }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({
    x: direction < 0 ? "100%" : "-100%",
    opacity: 0,
  }),
};

export default function Player({
  photos,
  title,
  initialIndex = 0,
  onClose,
}: {
  photos: GalleryPhoto[];
  title: string;
  initialIndex?: number;
  onClose: (lastIndex: number) => void;
}) {
  const [[index, direction], setIndexState] = useState<[number, number]>([
    Math.min(Math.max(initialIndex, 0), photos.length - 1),
    0,
  ]);
  const [isPlaying, setIsPlaying] = useState(false);
  const filmstripRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(index);
  indexRef.current = index;

  const goTo = useCallback(
    (nextIndex: number, dir: number) => {
      const wrapped = (nextIndex + photos.length) % photos.length;
      setIndexState([wrapped, dir]);
    },
    [photos.length]
  );

  const goNext = useCallback(() => goTo(index + 1, 1), [goTo, index]);
  const goPrev = useCallback(() => goTo(index - 1, -1), [goTo, index]);
  const close = useCallback(() => onClose(indexRef.current), [onClose]);

  // keyboard nav
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close();
      else if (event.key === "ArrowRight") goNext();
      else if (event.key === "ArrowLeft") goPrev();
      else if (event.key === " ") {
        event.preventDefault();
        setIsPlaying((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [close, goNext, goPrev]);

  // autoplay
  useEffect(() => {
    if (!isPlaying || photos.length <= 1) return;
    const id = setInterval(() => {
      setIndexState(([current]) => [(current + 1) % photos.length, 1]);
    }, AUTOPLAY_INTERVAL_MS);
    return () => clearInterval(id);
  }, [isPlaying, photos.length]);

  // preload neighbors
  useEffect(() => {
    [index - 1, index + 1].forEach((i) => {
      const wrapped = (i + photos.length) % photos.length;
      const src = photos[wrapped]?.src;
      if (!src) return;
      const img = new window.Image();
      img.src = src;
    });
  }, [index, photos]);

  // keep active filmstrip thumb in view
  useEffect(() => {
    const active = filmstripRef.current?.querySelector<HTMLElement>(`[data-index="${index}"]`);
    active?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [index]);

  const photo = photos[index];

  const handleDragEnd = (
    _event: MouseEvent | TouchEvent | PointerEvent,
    info: PanInfo
  ) => {
    if (photos.length <= 1) return;
    const { offset, velocity } = info;
    if (offset.x < -SWIPE_THRESHOLD_PX || velocity.x < -SWIPE_VELOCITY_THRESHOLD) {
      goNext();
    } else if (offset.x > SWIPE_THRESHOLD_PX || velocity.x > SWIPE_VELOCITY_THRESHOLD) {
      goPrev();
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      transition={{ duration: 0.25 }}
      className="fixed inset-0 z-[110] flex flex-col bg-black/95"
    >
      {/* blurred backdrop of current photo */}
      <div className="absolute inset-0 overflow-hidden">
        <Image
          src={photo.src}
          alt=""
          fill
          className="scale-110 object-cover opacity-30 blur-3xl"
          sizes="100vw"
          priority
        />
        <div className="absolute inset-0 bg-black/50" />
      </div>

      {/* header */}
      <div className="relative z-10 flex items-center justify-between px-4 py-4 md:px-6">
        <div className="min-w-0">
          <h2 className="truncate font-semibold text-white">{title}</h2>
          <p className="text-sm text-white/50">
            {index + 1} / {photos.length}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {photos.length > 1 && (
            <motion.button
              type="button"
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              onClick={() => setIsPlaying((prev) => !prev)}
              aria-label={isPlaying ? "Pause slideshow" : "Play slideshow"}
              className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20"
            >
              {isPlaying ? <Pause size={18} /> : <Play size={18} />}
            </motion.button>
          )}
          <motion.button
            type="button"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            onClick={close}
            aria-label="Close"
            className="rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-red"
          >
            <X size={18} />
          </motion.button>
        </div>
      </div>

      {/* main slide area */}
      <div className="relative z-10 flex flex-1 items-center justify-center overflow-hidden px-2">
        {photos.length > 1 && (
          <motion.button
            type="button"
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            onClick={goPrev}
            aria-label="Previous photo"
            className="absolute left-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 md:left-6 md:p-3"
          >
            <ChevronLeft size={22} />
          </motion.button>
        )}

        <AnimatePresence initial={false} custom={direction} mode="wait">
          <motion.div
            key={photo.id}
            custom={direction}
            variants={slideVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ type: "spring", stiffness: 300, damping: 30 }}
            drag={photos.length > 1 ? "x" : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.7}
            onDragEnd={handleDragEnd}
            className="relative h-[62vh] w-full max-w-4xl md:h-[70vh]"
          >
            <Image
              src={photo.src}
              alt={photo.alt}
              fill
              sizes="100vw"
              className="pointer-events-none object-contain select-none"
              priority
            />
          </motion.div>
        </AnimatePresence>

        {photos.length > 1 && (
          <motion.button
            type="button"
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            onClick={goNext}
            aria-label="Next photo"
            className="absolute right-2 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition-colors hover:bg-white/20 md:right-6 md:p-3"
          >
            <ChevronRight size={22} />
          </motion.button>
        )}
      </div>

      {/* filmstrip */}
      {photos.length > 1 && (
        <div
          ref={filmstripRef}
          className="relative z-10 flex gap-2 overflow-x-auto px-4 pb-4 pt-1 md:justify-center"
        >
          {photos.map((p, i) => (
            <motion.button
              key={p.id}
              type="button"
              data-index={i}
              whileHover={{ scale: 1.12, y: -3 }}
              whileTap={{ scale: 0.95 }}
              animate={{ opacity: i === index ? 1 : 0.5 }}
              onClick={() => goTo(i, i > index ? 1 : -1)}
              aria-label={`Go to photo ${i + 1}`}
              className={cn(
                "relative h-12 w-12 shrink-0 overflow-hidden rounded-md border-2 transition-colors",
                i === index ? "border-red" : "border-transparent"
              )}
            >
              <Image src={p.src} alt={p.alt} fill className="object-cover" sizes="48px" />
            </motion.button>
          ))}
        </div>
      )}
    </motion.div>
  );
}
