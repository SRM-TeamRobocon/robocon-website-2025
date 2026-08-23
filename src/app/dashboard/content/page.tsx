import Link from "next/link";
import { redirect } from "next/navigation";
import { contentResourceList } from "@/lib/content-resources";
import { getSession, requireRole } from "@/lib/session";

export default async function AdminContentHome() {
  const session = await getSession();
  if (!requireRole(session, ["lead", "admin"])) redirect("/dashboard");

  const resources = contentResourceList();

  return (
    <div className="space-y-8">
      <div>
        <p className="text-sm font-bold uppercase tracking-wider text-red">Supabase CMS</p>
        <h1 className="text-4xl font-black text-white">Website Content</h1>
        <p className="mt-2 max-w-2xl text-sm text-gray-400">
          Add and update public website content without editing source files.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {resources.map((resource) => (
          <Link
            key={resource.table}
            href={`/dashboard/content/${resource.table}`}
            className="relative isolate bg-gray-950/70 p-5 transition before:content-[''] before:absolute before:-inset-px before:-z-10 before:[clip-path:var(--clip)] before:bg-white/10 hover:bg-white/10 hover:before:bg-red/60"
            style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)", "--clip": "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" } as any}
          >
            <h2 className="text-xl font-bold text-white">{resource.pluralLabel}</h2>
            <p className="mt-2 text-sm text-gray-400">
              {resource.readonly ? "Review and update status." : `Manage ${resource.pluralLabel.toLowerCase()}.`}
            </p>
          </Link>
        ))}

        <Link
          href="/dashboard/blogs/new"
          className="relative isolate bg-gray-950/70 p-5 transition before:content-[''] before:absolute before:-inset-px before:-z-10 before:[clip-path:var(--clip)] before:bg-white/10 hover:bg-white/10 hover:before:bg-red/60"
          style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)", "--clip": "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" } as any}
        >
          <h2 className="text-xl font-bold text-white">Blogs</h2>
          <p className="mt-2 text-sm text-gray-400">Write a new blog post.</p>
        </Link>

        <Link
          href="/dashboard/mentors"
          className="relative isolate bg-gray-950/70 p-5 transition before:content-[''] before:absolute before:-inset-px before:-z-10 before:[clip-path:var(--clip)] before:bg-white/10 hover:bg-white/10 hover:before:bg-red/60"
          style={{ clipPath: "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)", "--clip": "polygon(0 0, 100% 0, 100% 92%, 92% 100%, 0 100%)" } as any}
        >
          <h2 className="text-xl font-bold text-white">Mentors</h2>
          <p className="mt-2 text-sm text-gray-400">Manage mentors.</p>
        </Link>
      </div>
    </div>
  );
}
