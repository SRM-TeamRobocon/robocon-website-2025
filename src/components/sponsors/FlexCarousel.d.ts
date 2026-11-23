import React from "react";

export interface FlexCarouselItem {
  src: string;
  alt?: string;
  title?: string;
  subtitle?: string;
  href?: string;
}

export interface FlexCarouselProps {
  items?: FlexCarouselItem[];
  preset?: "liquid" | "ribbon" | "vortex" | "arch";
  intro?: "rise" | "bloom" | "spin" | "deal" | "fade";
  cardHeight?: number;
  gap?: number;
  radius?: number;
  fit?: "natural" | "cover" | "contain";
  lensWidth?: number;
  lensHeight?: number;
  tilt?: number;
  roundness?: number;
  bend?: number;
  reach?: number;
  curl?: "twist" | "rise";
  dispersion?: number;
  liquid?: number;
  followCursor?: boolean;
  squeeze?: number;
  focusOnClick?: boolean;
  autoplay?: boolean;
  interval?: number;
  captions?: boolean;
  captureWheel?: boolean;
  onChange?: (index: number) => void;
  onSelect?: (index: number, item: FlexCarouselItem) => void;
  className?: string;
  style?: React.CSSProperties;
}

declare const FlexCarousel: React.ComponentType<FlexCarouselProps>;
export default FlexCarousel;
