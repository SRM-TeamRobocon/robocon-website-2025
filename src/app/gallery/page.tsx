import Header from "@/components/Header";
import Footer from "@/components/Footer";
import GalleryClient from "./GalleryClient";
import type { Album } from "./AlbumCard";
import { createPublicSupabaseClient } from "@/lib/supabase/public";

async function getAlbums(): Promise<Album[]> {
  const supabase = createPublicSupabaseClient();
  if (!supabase) return [];

  const [{ data: albums, error: albumsError }, { data: photos, error: photosError }] = await Promise.all([
    supabase.from("gallery_albums").select("id, title").order("display_order", { ascending: false }),
    supabase
      .from("gallery")
      .select("album_id, image_url, title")
      .order("display_order", { ascending: true }),
  ]);

  if (albumsError || photosError || !albums?.length || !photos?.length) return [];

  return albums
    .map((album) => ({
      id: album.id,
      title: album.title,
      photos: photos
        .filter((photo) => photo.album_id === album.id)
        .map((photo, index) => ({
          id: `${album.id}-${index}`,
          src: photo.image_url,
          alt: photo.title || album.title,
        })),
    }))
    .filter((album) => album.photos.length > 0);
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
