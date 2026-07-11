"use client";

import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import React, { useState, useId, useRef } from "react";
import { useOutsideClick } from "@/hooks/use-outside-click";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface GalleryPhoto {
  id: string;
  src: string;
  alt: string;
}

const FAN_CONFIG = [
  { rotation: -15, x: -90, y: 10, zIndex: 10 },
  { rotation: -3, x: -10, y: -15, zIndex: 20 },
  { rotation: 12, x: 75, y: 5, zIndex: 30 },
] as const;

const transition = {
  type: "spring",
  stiffness: 160,
  damping: 18,
  mass: 1,
} as const;

interface ExpandableGalleryProps {
  photos: GalleryPhoto[];
  title: string;
  description?: string;
  defaultExpanded?: boolean;
  onBack?: () => void;
}

export function ExpandableGallery({
  photos,
  title,
  description,
  defaultExpanded = false,
  onBack,
}: ExpandableGalleryProps) {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);
  const layoutGroupId = useId();
  const containerRef = useRef<HTMLDivElement>(null);

  const collapse = () => {
    if (onBack) {
      onBack();
    } else {
      setIsExpanded(false);
    }
  };

  useOutsideClick(containerRef, () => {
    if (isExpanded && !onBack) {
      setIsExpanded(false);
    }
  });

  return (
    <section className="relative w-full px-4 md:px-8 flex flex-col items-center justify-start min-h-[600px] overflow-hidden">
      <LayoutGroup id={layoutGroupId}>
        <div className="w-full max-w-6xl mx-auto flex flex-col items-center">
          <div className="w-full h-12 flex items-center justify-between px-4 mb-2">
            <AnimatePresence>
              {isExpanded && (
                <motion.button
                  key="back-button"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  onClick={collapse}
                  className="flex items-center gap-2 text-white/60 hover:text-white transition-all group z-50"
                >
                  <div className="p-2 rounded-full bg-white/10 group-hover:bg-white/20 transition-colors text-white">
                    <ArrowLeft size={20} />
                  </div>
                  <span className="font-medium">
                    {onBack ? "Back to albums" : "Go back"}
                  </span>
                </motion.button>
              )}
            </AnimatePresence>
          </div>

          <motion.div
            ref={containerRef}
            layout
            className={cn(
              "relative w-full",
              isExpanded
                ? "grid grid-cols-2 lg:grid-cols-3 gap-6 md:gap-8 px-4"
                : "flex flex-col items-center justify-start pt-4"
            )}
            transition={transition}
          >
            <div
              className={cn(
                "relative",
                isExpanded
                  ? "contents"
                  : "h-[450px] w-full flex items-center justify-center mb-8"
              )}
            >
              {photos.map((photo, index) => {
                const fan = FAN_CONFIG[index];
                const isPrimary = index < 3;
                if (!isPrimary && !isExpanded) return null;

                return (
                  <motion.div
                    key={`card-${photo.id}`}
                    layoutId={`card-container-${photo.id}`}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{
                      opacity: 1,
                      scale: 1,
                      rotate: !isExpanded ? fan?.rotation || 0 : 0,
                      x: !isExpanded ? fan?.x || 0 : 0,
                      y: !isExpanded ? fan?.y || 0 : 0,
                      zIndex: !isExpanded ? fan?.zIndex || index : 10,
                    }}
                    transition={transition}
                    whileHover={
                      !isExpanded
                        ? {
                            scale: 1.05,
                            y: (fan?.y || 0) - 15,
                            rotate: (fan?.rotation || 0) * 0.8,
                            zIndex: 50,
                            transition: {
                              type: "spring",
                              stiffness: 400,
                              damping: 25,
                            },
                          }
                        : { scale: 1.02 }
                    }
                    className={cn(
                      "cursor-pointer overflow-hidden bg-white/5",
                      isExpanded
                        ? "relative aspect-square rounded-[2rem] md:rounded-[3rem] border-4 md:border-[6px] border-black shadow-lg"
                        : "absolute w-44 h-44 md:w-60 md:h-60 rounded-[2.5rem] md:rounded-[3rem] border-[6px] border-black shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
                    )}
                    onClick={() => !isExpanded && setIsExpanded(true)}
                  >
                    <motion.div
                      layoutId={`image-inner-${photo.id}`}
                      layout="position"
                      className="w-full h-full relative"
                      transition={transition}
                    >
                      <Image
                        src={photo.src}
                        alt={photo.alt}
                        fill
                        className="object-cover select-none pointer-events-none"
                        sizes={
                          isExpanded
                            ? "(max-width: 1024px) 50vw, 33vw"
                            : "240px"
                        }
                        priority={isPrimary}
                      />
                    </motion.div>
                  </motion.div>
                );
              })}
            </div>

            <AnimatePresence>
              {!isExpanded && (
                <motion.div
                  key="stack-content"
                  initial={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="text-center max-w-2xl space-y-8"
                >
                  <h2 className="text-2xl md:text-4xl font-normal tracking-tight text-white/90 leading-tight">
                    {title}
                  </h2>
                  {description && (
                    <p className="text-white/60 text-base md:text-lg -mt-4">
                      {description}
                    </p>
                  )}

                  <div className="flex justify-center">
                    <Button
                      variant="default"
                      onClick={() => setIsExpanded(true)}
                      className="rounded-full cursor-pointer py-6 px-8 font-normal group"
                    >
                      View album
                      <ArrowRight
                        className="transition-transform group-hover:translate-x-1"
                        size={20}
                      />
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        </div>
      </LayoutGroup>
    </section>
  );
}

export default ExpandableGallery;
