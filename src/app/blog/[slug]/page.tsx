import { notFound } from "next/navigation";
import { cache } from "react";
import type { Metadata } from "next";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import BlogRenderer from "@/components/blog/BlogRenderer";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getBlogExcerpt, type BlogBlock } from "@/lib/blog";
import { pageMetadata, serializeJsonLd, SITE_NAME, SITE_URL, SOCIAL_IMAGE } from "@/lib/seo";

export const revalidate = 60;

interface PublicBlogDetail {
    title: string;
    cover_image_url: string | null;
    content: BlogBlock[];
    author_name: string;
    published_at: string | null;
}

const getPublicBlog = cache(async (slug: string): Promise<PublicBlogDetail | null> => {
    try {
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
    } catch (err) {
        console.warn(`getPublicBlog: Supabase admin client unavailable or query failed for "${slug}":`, err);
        return null;
    }
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
    const { slug } = await params;
    const blog = await getPublicBlog(slug);
    if (!blog) notFound();

    const description = getBlogExcerpt(blog.content) || `${blog.title} ? a story from ${SITE_NAME}.`;
    const metadata = pageMetadata(`/blog/${encodeURIComponent(slug)}`, blog.title, description);
    const images = blog.cover_image_url ? [{ url: blog.cover_image_url, alt: blog.title }] : [SOCIAL_IMAGE];
    return {
        ...metadata,
        authors: [{ name: blog.author_name }],
        openGraph: {
            ...metadata.openGraph,
            type: "article",
            publishedTime: blog.published_at || undefined,
            authors: [blog.author_name],
            images,
        },
        twitter: { ...metadata.twitter, images },
    };
}

export default async function BlogDetailPage({ params }: { params: Promise<{ slug: string }> }) {
    const { slug } = await params;
    const blog = await getPublicBlog(slug);

    if (!blog) notFound();

    const url = `${SITE_URL}/blog/${encodeURIComponent(slug)}`;
    const structuredData = {
        "@context": "https://schema.org",
        "@graph": [
            {
                "@type": "BlogPosting",
                "@id": `${url}#article`,
                mainEntityOfPage: url,
                headline: blog.title,
                description: getBlogExcerpt(blog.content),
                image: blog.cover_image_url || `${SITE_URL}${SOCIAL_IMAGE.url}`,
                datePublished: blog.published_at || undefined,
                author: { "@type": "Person", name: blog.author_name },
                publisher: { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: SITE_NAME, url: SITE_URL, logo: { "@type": "ImageObject", url: `${SITE_URL}/LOGO.png` } },
                inLanguage: "en-IN",
            },
            {
                "@type": "BreadcrumbList",
                itemListElement: [
                    { "@type": "ListItem", position: 1, name: "Home", item: `${SITE_URL}/` },
                    { "@type": "ListItem", position: 2, name: "Blog", item: `${SITE_URL}/blog` },
                    { "@type": "ListItem", position: 3, name: blog.title, item: url },
                ],
            },
        ],
    };

    return (
        <div>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(structuredData) }} />
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
