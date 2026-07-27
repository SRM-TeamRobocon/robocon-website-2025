import { redirect } from "next/navigation";
import AdminMentorManager from "@/components/admin/AdminMentorManager";
import { getSession, requireRole } from "@/lib/session";

export default async function AdminMentorsPage() {
  const session = await getSession();
  if (!requireRole(session, ["lead", "admin"])) redirect("/dashboard");

  return <AdminMentorManager />;
}
