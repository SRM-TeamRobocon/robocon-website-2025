/**
 * One-off, SAFE-TO-RE-RUN import of `alumni` rows into Supabase from a local
 * curated JSON file (produced by a separate scrape step — that step is not
 * part of this script; this only imports whatever the JSON file contains).
 *
 * Unlike the old scripts/migrate-content.ts (removed in commit 359021b — see
 * git history), which did plain inserts with no dedupe and was explicitly
 * documented as unsafe to re-run against a populated database, this script:
 *
 *   - Skips any entry that already has a matching row in `alumni` (matched
 *     on name, case-insensitive, + exact batch), logging "skipped, already
 *     exists" instead of inserting a duplicate. Re-running this after a
 *     partial run, or after the curated file gains new entries, is safe.
 *   - Re-hosts external photo_url values into the `member-photos` Storage
 *     bucket (same bucket/pattern used for the public `members` roster —
 *     see the old migrate-content.ts's uploadFromUrl / the members photo
 *     upload route). A failed download/upload is a per-row warning, not a
 *     fatal error: the row is still inserted, just with the original
 *     external URL. AlumniCard already falls back to a placeholder image
 *     if photo_url is ever empty, so this doesn't need to be perfect.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/import-alumni.ts [path-to-json]
 *   npm run import:alumni -- [path-to-json]
 *
 * Defaults to scrape/alumni-curated.json (that whole directory is
 * gitignored — see .gitignore — and the file doesn't exist yet; a later
 * scrape step produces it).
 *
 * Input JSON shape: an array (or `{ "alumni": [...] }`) of objects:
 *   {
 *     name: string,               // required
 *     domain?: string,
 *     designation?: string,
 *     about?: string,
 *     description?: string,
 *     profession?: string,
 *     batch?: string,
 *     photo_url?: string,         // may be an external/old-site URL
 *     linkedin_url?: string,
 *     instagram_url?: string,
 *     facebook_url?: string,
 *   }
 *
 * Not importing src/lib/supabase/admin.ts here on purpose — it imports
 * "server-only", which is meant to throw when pulled into anything other
 * than a Next.js server bundle. Constructing the client inline instead,
 * same as scripts/seed-recruitment.ts and the deleted migrate-content.ts.
 */

import fs from "fs";
import path from "path";
import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Input / row shapes
// ---------------------------------------------------------------------------

type AlumniEntry = {
  name?: unknown;
  domain?: unknown;
  designation?: unknown;
  about?: unknown;
  description?: unknown;
  profession?: unknown;
  batch?: unknown;
  photo_url?: unknown;
  linkedin_url?: unknown;
  instagram_url?: unknown;
  facebook_url?: unknown;
};

type AlumniRow = {
  name: string;
  domain: string | null;
  designation: string | null;
  about: string | null;
  description: string | null;
  profession: string | null;
  batch: string | null;
  photo_url: string | null;
  linkedin_url: string | null;
  instagram_url: string | null;
  facebook_url: string | null;
};

const PHOTO_BUCKET = "member-photos";
const PHOTO_FOLDER = "alumni";

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

function clean(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

/** Escapes %, _ and \ so a name is matched literally (case-insensitively), not as an ILIKE wildcard pattern. */
function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/** Heuristic: is this URL already a Supabase Storage public URL (any project), so re-hosting would be redundant? */
function isSupabaseStorageUrl(url: string): boolean {
  return url.includes("/storage/v1/object/public/");
}

/**
 * Downloads an external image and re-uploads it into Supabase Storage.
 * Returns the new public URL, or null if anything went wrong — the caller
 * falls back to the original URL rather than treating this as fatal.
 */
async function rehostImage(supabase: SupabaseClient, sourceUrl: string): Promise<string | null> {
  try {
    const res = await fetch(sourceUrl);
    if (!res.ok) {
      console.warn(`    [rehost] fetch failed (${res.status}): ${sourceUrl}`);
      return null;
    }

    const bytes = Buffer.from(await res.arrayBuffer());
    const contentType = res.headers.get("content-type") || "image/jpeg";
    const ext = contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
        ? "webp"
        : contentType.includes("gif")
          ? "gif"
          : "jpg";
    const storagePath = `${PHOTO_FOLDER}/${randomUUID()}.${ext}`;

    const { error } = await supabase.storage.from(PHOTO_BUCKET).upload(storagePath, bytes, {
      contentType,
      upsert: false,
    });
    if (error) {
      console.warn(`    [rehost] upload failed for ${sourceUrl}: ${error.message}`);
      return null;
    }

    const { data } = supabase.storage.from(PHOTO_BUCKET).getPublicUrl(storagePath);
    return data.publicUrl;
  } catch (err) {
    console.warn(`    [rehost] error for ${sourceUrl}: ${err instanceof Error ? err.message : String(err)}`);
    return null;
  }
}

/** True when a row already exists for this (name, batch) — case-insensitive on name, exact on batch. */
async function alreadyExists(supabase: SupabaseClient, name: string, batch: string | null): Promise<boolean> {
  const base = supabase.from("alumni").select("id").ilike("name", escapeIlike(name));
  const { data, error } = batch ? await base.eq("batch", batch).limit(1) : await base.is("batch", null).limit(1);

  if (error) throw new Error(`lookup failed for "${name}": ${error.message}`);
  return Boolean(data && data.length > 0);
}

function loadEntries(inputPath: string): AlumniEntry[] {
  const absPath = path.resolve(process.cwd(), inputPath);
  if (!fs.existsSync(absPath)) {
    throw new Error(
      `Input file not found: ${absPath}\n` +
        `Pass a path as the first CLI arg, or generate ${inputPath} first (a later scrape step produces this file).`
    );
  }

  const raw = fs.readFileSync(absPath, "utf8");
  const parsed = JSON.parse(raw);
  const entries = Array.isArray(parsed) ? parsed : Array.isArray((parsed as { alumni?: unknown })?.alumni) ? (parsed as { alumni: unknown[] }).alumni : null;

  if (!entries) {
    throw new Error(`${absPath} must be a JSON array of alumni entries (or an object with an "alumni" array).`);
  }

  return entries as AlumniEntry[];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run() {
  const inputPath = process.argv[2] || "scrape/alumni-curated.json";

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY must be set (run via `npx tsx --env-file=.env.local ...` or `npm run import:alumni`)."
    );
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Reading alumni entries from ${inputPath}...`);
  const entries = loadEntries(inputPath);
  console.log(`Loaded ${entries.length} entr${entries.length === 1 ? "y" : "ies"}.\n`);

  let inserted = 0;
  let skipped = 0;
  let invalid = 0;
  let insertFailed = 0;
  const rehostFailures: string[] = [];

  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i];
    const name = clean(entry?.name);
    const label = name || `entry #${i + 1}`;

    if (!name) {
      console.warn(`  [invalid] ${label}: missing required "name" — skipped`);
      invalid++;
      continue;
    }

    const batch = clean(entry.batch);

    let exists: boolean;
    try {
      exists = await alreadyExists(supabase, name, batch);
    } catch (err) {
      console.warn(`  [invalid] ${label}: ${err instanceof Error ? err.message : String(err)}`);
      invalid++;
      continue;
    }

    if (exists) {
      console.log(`  [skipped, already exists] ${label}${batch ? ` (${batch})` : ""}`);
      skipped++;
      continue;
    }

    let photoUrl = clean(entry.photo_url);
    if (photoUrl && !isSupabaseStorageUrl(photoUrl)) {
      const rehosted = await rehostImage(supabase, photoUrl);
      if (rehosted) {
        photoUrl = rehosted;
      } else {
        // Keep the original external URL — a broken re-host on one person
        // shouldn't block everyone else, and it's not empty, just external.
        rehostFailures.push(label);
      }
    }

    const row: AlumniRow = {
      name,
      domain: clean(entry.domain),
      designation: clean(entry.designation),
      about: clean(entry.about),
      description: clean(entry.description),
      profession: clean(entry.profession),
      batch,
      photo_url: photoUrl,
      linkedin_url: clean(entry.linkedin_url),
      instagram_url: clean(entry.instagram_url),
      facebook_url: clean(entry.facebook_url),
    };

    const { error } = await supabase.from("alumni").insert(row);
    if (error) {
      console.error(`  [insert failed] ${label}: ${error.message}`);
      insertFailed++;
      continue;
    }

    console.log(`  [inserted] ${label}${batch ? ` (${batch})` : ""}`);
    inserted++;
  }

  console.log("\n========================================================================");
  console.log("  SUMMARY");
  console.log("========================================================================");
  console.log(`  Inserted                : ${inserted}`);
  console.log(`  Skipped (already exists): ${skipped}`);
  console.log(`  Invalid entries         : ${invalid}`);
  console.log(`  Insert failures         : ${insertFailed}`);
  console.log(`  Image re-hosts failed   : ${rehostFailures.length}${rehostFailures.length ? " (kept original URL)" : ""}`);
  if (rehostFailures.length) {
    rehostFailures.forEach((n) => console.log(`    - ${n}`));
  }
  console.log("========================================================================\n");

  if (insertFailed > 0) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error("\nImport failed:");
  console.error(err);
  process.exit(1);
});
