import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ContentGrid, { type ContentCardItem } from "@/components/ContentGrid";
import { events } from "@/constants/constants";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { formatDate } from "@/lib/utils";
import type { Event } from "@/constants/types";

// Set to `false` to make this page fully static (only updates on redeploy).
// Set to a number of seconds (e.g. 60) to auto-refresh after that many seconds — Next.js requires
// this to be a literal value here, it can't be imported from a shared config file.
export const revalidate = 60;

interface SupabaseEvent {
  title: string;
  description: string | null;
  abstract: string | null;
  cover_image_url: string | null;
  cover_width: number | null;
  cover_height: number | null;
  gallery_urls: string[] | null;
  event_date: string | null;
  location: string | null;
  is_upcoming: boolean | null;
}

function mapSupabaseEvents(rows: SupabaseEvent[]): Event[] {
  return rows.map((row) => ({
    name: row.title,
    description: row.description || "",
    coverImage: row.cover_image_url || "",
    abstract: row.abstract || "",
    gallery: row.gallery_urls || [],
    dimensions: {
      height: row.cover_height || 220,
      width: row.cover_width || 360,
    },
    eventDate: row.event_date || undefined,
    location: row.location || undefined,
    isUpcoming: row.is_upcoming || undefined,
  }));
}

async function getEvents(): Promise<Event[]> {
  const supabase = createPublicSupabaseClient();
  if (!supabase) return events;

  const { data, error } = await supabase
    .from("events")
    .select(
      "title, description, abstract, cover_image_url, cover_width, cover_height, gallery_urls, event_date, location, is_upcoming"
    )
    .order("event_date", { ascending: false, nullsFirst: false });

  if (error || !data?.length) return events;
  return mapSupabaseEvents(data);
}

function toCardItems(items: Event[]): ContentCardItem[] {
  return items.map((event, index) => ({
    key: `${event.name}-${index}`,
    name: event.name,
    coverImage: event.coverImage,
    abstract: event.abstract,
    description: event.description,
    gallery: event.gallery,
    badges: [event.isUpcoming ? "Upcoming" : undefined, event.location, formatDate(event.eventDate)].filter(
      Boolean
    ) as string[],
  }));
}

export default async function EventsPage() {
  const data = await getEvents();
  const items = toCardItems(data);

  return (
    <div>
      <Header />
      <section className="px-4 pb-10 pt-28 text-center md:pt-36">
        <h1 className="text-3xl font-bold text-white md:text-5xl">Events</h1>
        <p className="mx-auto mt-4 max-w-xl text-white/60">{items.length} moments from the team's calendar.</p>
      </section>
      <ContentGrid items={items} searchPlaceholder="Search events..." />
      <Footer />
    </div>
  );
}
