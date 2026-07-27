import { notFound } from "next/navigation";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BlogRenderer from "@/components/blog/BlogRenderer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import type { BlogBlock } from "@/lib/blog";

export const revalidate = 60;

interface PublicBlogDetail {
    title: string;
    cover_image_url: string | null;
    content: BlogBlock[];
    author_name: string;
    published_at: string | null;
}

async function getPublicBlog(slug: string): Promise<PublicBlogDetail | null> {
    const supabase = createSupabaseAdminClient();
    const { data, error } = await supabase
        .from("blogs")
        .select("title, cover_image_url, content, author_name, published_at")
        .eq("slug", slug)
        .eq("status", "approved")
        .eq("visibility", "public")
        .maybeSingle();

    if (error || !data) return null;
    return data as unknown as PublicBlogDetail;
}

export default async function BlogDetailPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const blog = await getPublicBlog(slug);

    if (!blog) notFound();

    return (
        <div>
            <Header />
            <section className="px-4 pb-24 pt-28 md:pt-36">
                <BlogRenderer
                    title={blog.title}
                    coverImageUrl={blog.cover_image_url}
                    authorName={blog.author_name}
                    publishedAt={blog.published_at}
                    blocks={blog.content}
                />
            </section>
            <Footer />
        </div>
    );
}
