import type { MetadataRoute } from "next";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { PUBLIC_PAGES, SITE_URL } from "@/lib/seo";

export const revalidate = 60;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const entries: MetadataRoute.Sitemap = Object.keys(PUBLIC_PAGES).map((path) => ({
    url: `${SITE_URL}${path}`,
  }));

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return entries;
  }

  try {
    const supabase = createSupabaseAdminClient();
    const pageSize = 1000;
    for (let from = 0; ; from += pageSize) {
      const { data, error } = await supabase
        .from("blogs")
        .select("slug")
        .eq("status", "approved")
        .eq("visibility", "public")
        .order("slug")
        .range(from, from + pageSize - 1);

      if (error) {
        console.error("Unable to load blog URLs for the sitemap:", error.message);
        break;
      }
      for (const blog of data ?? []) {
        entries.push({ url: `${SITE_URL}/blog/${encodeURIComponent(blog.slug)}` });
      }
      // Blogs have no updated_at; omit lastmod rather than inventing a modification date.
      if (!data || data.length < pageSize) break;
    }
  } catch (error) {
    console.error("Unable to load blog URLs for the sitemap:", error);
  }

  return entries;
}
