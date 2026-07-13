import Header from "@/components/Header";
import Footer from "@/components/Footer";
import GalleryClient from "./GalleryClient";
import type { Album } from "./AlbumCard";
import type { GalleryPhoto } from "@/components/ui/expandable-gallery";
import jsonData from "@/app/gallery/carousel-data.json";
import { createPublicSupabaseClient } from "@/lib/supabase/public";

interface SupabaseGalleryImage {
  image_url: string;
  title: string | null;
  category: string | null;
}

interface FallbackGalleryItem {
  src: string;
  title: string;
  category: string;
}

function groupIntoAlbums(
  rows: { src: string; title: string | null; category: string | null }[]
): Album[] {
  const order: string[] = [];
  const byCategory = new Map<string, GalleryPhoto[]>();

  rows.forEach((row, index) => {
    const category = row.category?.trim() || "Uncategorized";
    if (!byCategory.has(category)) {
      byCategory.set(category, []);
      order.push(category);
    }
    byCategory.get(category)!.push({
      id: `${category}-${index}`,
      src: row.src,
      alt: row.title || category,
    });
  });

  return order.map((category) => ({
    id: category,
    title: category,
    photos: byCategory.get(category) || [],
  }));
}

async function getAlbums(): Promise<Album[]> {
  const fallbackItems = jsonData as FallbackGalleryItem[];
  const fallbackAlbums = groupIntoAlbums(fallbackItems);

  const supabase = createPublicSupabaseClient();
  if (!supabase) return fallbackAlbums;

  const { data, error } = await supabase
    .from("gallery")
    .select("image_url, title, category")
    .order("display_order", { ascending: true });

  if (error || !data?.length) return fallbackAlbums;

  const rows = data as SupabaseGalleryImage[];
  return groupIntoAlbums(
    rows.map((row) => ({ src: row.image_url, title: row.title, category: row.category }))
  );
}

export default async function GalleryPage() {
  const albums = await getAlbums();
  const totalPhotos = albums.reduce((sum, album) => sum + album.photos.length, 0);

  return (
    <div>
      <Header />

      <section className="pt-28 md:pt-36 pb-10 text-center px-4">
        <h1 className="text-3xl md:text-5xl font-bold text-white">Our Gallery</h1>
        <p className="mt-4 text-white/60 max-w-xl mx-auto">
          {albums.length > 0
            ? `Pick an album to relive the moment — ${totalPhotos} photo${totalPhotos === 1 ? "" : "s"} across ${albums.length} album${albums.length === 1 ? "" : "s"}.`
            : "Pick an album to relive the moment."}
        </p>
      </section>

      <GalleryClient albums={albums} />

      <Footer />
    </div>
  );
}
