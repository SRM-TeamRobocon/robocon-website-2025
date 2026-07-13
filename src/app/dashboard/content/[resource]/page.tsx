import { notFound, redirect } from "next/navigation";
import AdminContentManager from "@/components/admin/AdminContentManager";
import { getContentResource } from "@/lib/content-resources";
import { getSession, requireRole } from "@/lib/session";

type PageProps = {
  params: Promise<{ resource: string }>;
};

export default async function AdminContentResourcePage({ params }: PageProps) {
  const session = await getSession();
  if (!requireRole(session, ["lead", "admin"])) redirect("/dashboard");

  const { resource } = await params;
  const config = getContentResource(resource);

  if (!config) notFound();

  return <AdminContentManager config={config} />;
}
