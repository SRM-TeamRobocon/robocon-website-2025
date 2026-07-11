import { notFound } from "next/navigation";
import AdminContentManager from "@/components/admin/AdminContentManager";
import { getContentResource } from "@/lib/content-resources";

type PageProps = {
  params: Promise<{ resource: string }>;
};

export default async function AdminContentResourcePage({ params }: PageProps) {
  const { resource } = await params;
  const config = getContentResource(resource);

  if (!config) notFound();

  return <AdminContentManager config={config} />;
}
