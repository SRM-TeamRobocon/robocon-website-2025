import type { GalleryPhoto } from "@/components/ui/expandable-gallery";

export interface Album {
  id: string;
  title: string;
  photos: GalleryPhoto[];
}
