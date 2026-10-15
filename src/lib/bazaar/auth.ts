import "server-only";
import { getSession } from "@/lib/session";
import { displayNameForUsername } from "@/lib/admin-users";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { BazaarUser, BazaarRole } from "./types";
import { BazaarError } from "./errors";

/**
 * Authentication adapter for Bazaar.
 * This is the ONLY file in the Bazaar module that interacts with the existing auth system.
 */

export async function getCurrentUser(): Promise<BazaarUser | null> {
  const session = await getSession();
  if (!session) return null;

  // In this system, admin and lead roles have identical leadership capabilities.
  const role: BazaarRole = session.role === "admin" || session.role === "lead" ? "lead" : "member";

  if (session.memberAccountId) {
    const supabase = createSupabaseAdminClient();
    const { data: account } = await supabase
      .from("member_accounts")
      .select("id, name, email, reg_no")
      .eq("id", session.memberAccountId)
      .maybeSingle();

    return {
      id: session.memberAccountId,
      name: account?.name || session.name || "Member",
      email: account?.email || session.user,
      regNumber: account?.reg_no,
      role,
      isStaffAccount: false,
    };
  }

  // Env-based staff login (e.g. LEAD_ACCOUNTS username)
  const resolvedName = session.name || displayNameForUsername(session.user) || "Admin";
  return {
    id: session.user,
    name: resolvedName,
    email: session.user.includes("@") ? session.user : undefined,
    role,
    isStaffAccount: true,
  };
}

export async function requireUser(): Promise<BazaarUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new BazaarError("BAZAAR_UNAUTHENTICATED", "Authentication required to access Bazaar", 401);
  }
  return user;
}

export async function requireLead(): Promise<BazaarUser> {
  const user = await requireUser();
  if (user.role !== "lead") {
    throw new BazaarError("BAZAAR_FORBIDDEN", "Lead privileges required for this action", 403);
  }
  return user;
}

export async function requireViewer(): Promise<BazaarUser> {
  const user = await requireUser();
  if (user.role !== "lead" && user.role !== "viewer") {
    throw new BazaarError("BAZAAR_FORBIDDEN", "Staff privileges required to view management data", 403);
  }
  return user;
}

export function actorString(user: BazaarUser): string {
  return `${user.role}:${user.id}`;
}
