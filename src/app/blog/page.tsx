import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BlogCard from "@/components/blog/BlogCard";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getBlogExcerpt, type BlogBlock } from "@/lib/blog";

export const revalidate = 60;

interface PublicBlogRow {
    title: string;
    slug: string;
    cover_image_url: string | null;
    content: BlogBlock[];
    author_name: string;
    published_at: string | null;
}

async function getPublicBlogs(): Promise<PublicBlogRow[]> {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
        .from("blogs")
        .select("title, slug, cover_image_url, content, author_name, published_at")
        .eq("status", "approved")
        .eq("visibility", "public")
        .order("published_at", { ascending: false });

    if (error || !data) return [];
    return data as unknown as PublicBlogRow[];
}

export default async function BlogListPage() {
    const blogs = await getPublicBlogs();

    return (
        <div>
            <Header />
            <section className="px-4 pb-10 pt-28 text-center md:pt-36">
                <h1 className="text-3xl font-bold text-white md:text-5xl">Blog</h1>
                <p className="mx-auto mt-4 max-w-xl text-white/60">Stories, builds, and updates from the team.</p>
            </section>

            <section className="mx-auto max-w-6xl px-4 pb-24">
                {blogs.length === 0 ? (
                    <p className="text-center text-white/40">No posts yet — check back soon.</p>
                ) : (
                    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                        {blogs.map((blog) => (
                            <BlogCard
                                key={blog.slug}
                                href={`/blog/${blog.slug}`}
                                title={blog.title}
                                excerpt={getBlogExcerpt(blog.content)}
                                coverImageUrl={blog.cover_image_url}
                                authorName={blog.author_name}
                                publishedAt={blog.published_at}
                            />
                        ))}
                    </div>
                )}
            </section>

            <Footer />
        </div>
    );
}
