import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Untyped on purpose: recruit_* tables live in supabase/recruit-schema.sql and are not
// part of the generated `Database` type in ./types.ts (which mirrors schema.sql only).
// Every recruitment API route should use this client instead of createSupabaseAdminClient().
export function createRecruitSupabaseAdminClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase admin environment variables are not configured.");
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
