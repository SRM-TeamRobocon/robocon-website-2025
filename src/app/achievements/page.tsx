import Header from "@/components/Header";
import Footer from "@/components/Footer";
import AchievementsHistory from "@/components/AchievementsHistory";
import ContentGrid, { type ContentCardItem } from "@/components/ContentGrid";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import { formatDate } from "@/lib/utils";
import type { Achievement } from "@/constants/types";

// Set to `false` to make this page fully static (only updates on redeploy).
// Set to a number of seconds (e.g. 60) to auto-refresh after that many seconds - Next.js requires
// this to be a literal value here, it can't be imported from a shared config file.
export const revalidate = 60;

interface SupabaseAchievement {
  title: string;
  description: string | null;
  abstract: string | null;
  cover_image_url: string | null;
  cover_width: number | null;
  cover_height: number | null;
  gallery_urls: string[] | null;
  achievement_date: string | null;
  competition: string | null;
  rank: string | null;
}

function mapSupabaseAchievements(rows: SupabaseAchievement[]): Achievement[] {
  return rows.map((row) => ({
    name: row.title,
    description: row.description || "",
    coverImage: row.cover_image_url || "",
    abstract: row.abstract || "",
    gallery: row.gallery_urls || [],
    dimensions1: {
      height: row.cover_height || 220,
      width: row.cover_width || 360,
    },
    achievementDate: row.achievement_date || undefined,
    competition: row.competition || undefined,
    rank: row.rank || undefined,
  }));
}

async function getAchievements(): Promise<Achievement[]> {
  const supabase = createPublicSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("achievements")
    .select(
      "title, description, abstract, cover_image_url, cover_width, cover_height, gallery_urls, achievement_date, competition, rank"
    )
    .order("achievement_date", { ascending: false, nullsFirst: false });

  if (error || !data?.length) return [];
  return mapSupabaseAchievements(data);
}

function toCardItems(items: Achievement[]): ContentCardItem[] {
  return items.map((achievement, index) => ({
    key: `${achievement.name}-${index}`,
    name: achievement.name,
    coverImage: achievement.coverImage,
    abstract: achievement.abstract,
    description: achievement.description,
    gallery: achievement.gallery,
    badges: [achievement.rank, achievement.competition, formatDate(achievement.achievementDate)].filter(
      Boolean
    ) as string[],
  }));
}

export default async function AchievementsPage() {
  const data = await getAchievements();
  const items = toCardItems(data);

  return (
    <div>
      <Header />
      <section className="px-4 pb-10 pt-28 text-center md:pt-36">
        <h1 className="text-3xl font-bold text-white md:text-5xl">Achievements</h1>
        {/* <p className="mx-auto mt-4 max-w-xl text-white/60">{items.length} wins the team is proud of.</p> */}
      </section>
      {/* <AchievementsHistory /> */}
      <ContentGrid items={items} searchPlaceholder="Search achievements..." />
      <Footer />
    </div>
  );
}
