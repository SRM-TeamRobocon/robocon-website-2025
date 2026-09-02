import Header from "@/components/Header";
import Footer from "@/components/Footer";
import ContentGrid, { type ContentCardItem } from "@/components/ContentGrid";
import { createPublicSupabaseClient } from "@/lib/supabase/public";
import type { Project } from "@/constants/types";

// Set to `false` to make this page fully static (only updates on redeploy).
// Set to a number of seconds (e.g. 60) to auto-refresh after that many seconds - Next.js requires
// this to be a literal value here, it can't be imported from a shared config file.
export const revalidate = 60;

interface SupabaseProject {
  title: string;
  description: string | null;
  abstract: string | null;
  cover_image_url: string | null;
  cover_width: number | null;
  cover_height: number | null;
  gallery_urls: string[] | null;
  shortkey: string | null;
  tech_stack: string[] | null;
  year: string | null;
  competition: string | null;
}

function mapSupabaseProjects(rows: SupabaseProject[]): Project[] {
  return rows.map((row) => ({
    name: row.title,
    description: row.description || "",
    coverImage: row.cover_image_url || "",
    abstract: row.abstract || "",
    gallery: row.gallery_urls || [],
    shortkey: row.shortkey || "",
    dimensions: {
      height: row.cover_height || 220,
      width: row.cover_width || 360,
    },
    techStack: row.tech_stack || undefined,
    year: row.year || undefined,
    competition: row.competition || undefined,
  }));
}

async function getProjects(): Promise<Project[]> {
  const supabase = createPublicSupabaseClient();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from("projects")
    .select(
      "title, description, abstract, cover_image_url, cover_width, cover_height, gallery_urls, shortkey, tech_stack, year, competition"
    )
    .order("year", { ascending: false, nullsFirst: false });

  if (error || !data?.length) return [];
  return mapSupabaseProjects(data);
}

function toCardItems(items: Project[]): ContentCardItem[] {
  return items.map((project, index) => ({
    key: `${project.name}-${index}`,
    name: project.name,
    coverImage: project.coverImage,
    abstract: project.abstract,
    description: project.description,
    gallery: project.gallery,
    badges: [...(project.techStack || []), project.year, project.competition].filter(Boolean) as string[],
  }));
}

export default async function ProjectsPage() {
  const data = await getProjects();
  const items = toCardItems(data);

  return (
    <div>
      <Header />
      <section className="px-4 pb-10 pt-28 text-center md:pt-36">
        <h1 className="text-3xl font-bold text-white md:text-5xl">Projects</h1>
        <p className="mx-auto mt-4 max-w-xl text-white/60">{items.length} builds from the team. Search to find one.</p>
      </section>
      <ContentGrid items={items} searchPlaceholder="Search projects..." />
      <Footer />
    </div>
  );
}
