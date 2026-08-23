/**
 * One-off, SAFE-TO-RE-RUN import of a hand-curated set of historical photos
 * from the old Wix site (srmtechrobocon.wixsite.com/website) into the
 * `gallery` / `gallery_albums` Supabase tables, under a new
 * "Archive (2013-2020)" album.
 *
 * The old site mixes real event/workshop photography with generic
 * decorative stock imagery (Wix's own stock library: drone renders,
 * "Agent on Duty" delivery-robot marketing renders), sponsor/tool logos
 * (Altium, MATLAB, ANSYS, SolidWorks, ...), UI chrome (social icons, the
 * footer logo), and personnel headshots. Every entry in CURATED_PHOTOS below
 * was individually downloaded and visually inspected before being included
 * here — nothing was picked from filename or surrounding text alone. Only
 * genuine event/competition/team/workshop/robot photography made the cut;
 * everything else (drone stock photo on /achiev, the "Agent on Duty" stock
 * render set and one genuine wheel-mechanism CAD render on /research,
 * personnel headshots, all home-page sponsor logos) was rejected.
 *
 * Idempotent-safe, same pattern as scripts/import-alumni.ts:
 *   - Creates the "Archive (2013-2020)" album only if it doesn't already
 *     exist (matched by exact title), with display_order = current max + 1.
 *   - Skips any photo that already has a matching `gallery` row (matched on
 *     title, case-insensitive, within that album) instead of inserting a
 *     duplicate — safe to re-run after a partial run.
 *   - Re-hosts each source image into the `gallery` Storage bucket (same
 *     rehostImage() pattern as import-alumni.ts's photo_url handling).
 *
 * Unlike import-alumni.ts, a failed re-host here is treated as FATAL for
 * that row (skipped, not inserted with the original URL) rather than a
 * fallback — next.config.js's images.remotePatterns does not allow
 * static.wixstatic.com, and GalleryClient.tsx renders every photo through
 * next/image, which errors on a disallowed hostname. An un-rehosted row
 * would break the gallery page, not just look worse.
 *
 * Usage:
 *   npx tsx --env-file=.env.local scripts/import-gallery.ts
 *   npm run import:gallery
 *
 * Not importing src/lib/supabase/admin.ts here on purpose — it imports
 * "server-only", which is meant to throw when pulled into anything other
 * than a Next.js server bundle. Constructing the client inline instead,
 * same as scripts/import-alumni.ts and the deleted migrate-content.ts.
 */

import { randomUUID } from "node:crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// ---------------------------------------------------------------------------
// Curated data — hand-picked and visually verified, see header comment.
// ---------------------------------------------------------------------------

const ALBUM_TITLE = "Archive (2013-2020)";
const PHOTO_BUCKET = "gallery";
const PHOTO_FOLDER = "archive";

type CuratedPhoto = {
  title: string;
  sourceUrl: string;
};

const CURATED_PHOTOS: CuratedPhoto[] = [
  {
    title: "Showcasing Our Robot",
    sourceUrl:
      "https://static.wixstatic.com/media/17a8bb_35d84480a6144cbca207b2626992ce8b~mv2.jpg/v1/fit/w_1920,h_1920,al_c,q_90/img.jpg",
  },
  {
    title: "Match Day Crowd",
    sourceUrl:
      "https://static.wixstatic.com/media/17a8bb_98991eebe3e24f48993411d9f3d29cc9~mv2_d_4208_3120_s_4_2.jpg/v1/fit/w_1920,h_1920,al_c,q_90/img.jpg",
  },
  {
    title: "On the Competition Floor",
    sourceUrl:
      "https://static.wixstatic.com/media/17a8bb_7a5557cd155e4ed980ddfafbb5bed274~mv2.jpg/v1/fit/w_1920,h_1920,al_c,q_90/img.jpg",
  },
  {
    title: "Robot Build in Progress",
    sourceUrl:
      "https://static.wixstatic.com/media/17a8bb_5734f12c236c4bb1986870b36e357085~mv2.jpg/v1/fit/w_1920,h_1920,al_c,q_90/img.jpg",
  },
  {
    title: "Wiring the Robot",
    sourceUrl:
      "https://static.wixstatic.com/media/17a8bb_af4dcfff7a4a420382378a8e7357eae8~mv2.jpg/v1/fit/w_1920,h_1920,al_c,q_90/img.jpg",
  },
  {
    title: "Chassis Frame Assembly",
    sourceUrl:
      "https://static.wixstatic.com/media/17a8bb_bb6ea964405b48cb817e812e83dd84ff~mv2.jpg/v1/fit/w_1920,h_1920,al_c,q_90/img.jpg",
  },
  {
    title: "Chassis on the Shop Floor",
    sourceUrl:
      "https://static.wixstatic.com/media/b8bfb3_b057ab421ce445d090f59e3fe7a7b981~mv2.jpeg/v1/fit/w_1920,h_1920,al_c,q_90/img.jpeg",
  },
  {
    title: "Wheel Mechanism Design",
    sourceUrl:
      "https://static.wixstatic.com/media/b8bfb3_67d5f5c3af30410ca1489f6f7473f8bb~mv2.jpg/v1/fit/w_1920,h_1920,al_c,q_90/img.jpg",
  },
];

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

/** Escapes %, _ and \ so a title is matched literally (case-insensitively), not as an ILIKE wildcard pattern. */
function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, (ch) => `\\${ch}`);
}

/**
 * Downloads an external image and re-uploads it into Supabase Storage.
 * Returns the new public URL, or null if anything went wrong.
 */
async function rehostImage(supabase: SupabaseClient, sourceUrl: string): Promise<string | null> {
  try {
    const res = await fetch(sourceUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36" },
    });
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

/** Finds the existing album by exact title, or creates it with display_order = max(existing) + 1. */
async function findOrCreateAlbum(supabase: SupabaseClient): Promise<string> {
  const { data: existing, error: findError } = await supabase
    .from("gallery_albums")
    .select("id")
    .eq("title", ALBUM_TITLE)
    .limit(1);

  if (findError) throw new Error(`album lookup failed: ${findError.message}`);
  if (existing && existing.length > 0) {
    console.log(`Album "${ALBUM_TITLE}" already exists (id=${existing[0].id}), reusing it.\n`);
    return existing[0].id as string;
  }

  const { data: maxRow, error: maxError } = await supabase
    .from("gallery_albums")
    .select("display_order")
    .order("display_order", { ascending: false })
    .limit(1);

  if (maxError) throw new Error(`max(display_order) lookup failed: ${maxError.message}`);
  const nextOrder = (maxRow && maxRow.length > 0 ? (maxRow[0].display_order as number) : 0) + 1;

  const { data: created, error: insertError } = await supabase
    .from("gallery_albums")
    .insert({ title: ALBUM_TITLE, display_order: nextOrder })
    .select("id")
    .single();

  if (insertError || !created) {
    throw new Error(`album creation failed: ${insertError?.message ?? "no row returned"}`);
  }

  console.log(`Created album "${ALBUM_TITLE}" (id=${created.id}, display_order=${nextOrder}).\n`);
  return created.id as string;
}

/** True when a `gallery` row already exists with this title (case-insensitive) inside this album. */
async function alreadyExists(supabase: SupabaseClient, albumId: string, title: string): Promise<boolean> {
  const { data, error } = await supabase
    .from("gallery")
    .select("id")
    .eq("album_id", albumId)
    .ilike("title", escapeIlike(title))
    .limit(1);

  if (error) throw new Error(`lookup failed for "${title}": ${error.message}`);
  return Boolean(data && data.length > 0);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function run() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRoleKey) {
    throw new Error(
      "NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY must be set (run via `npx tsx --env-file=.env.local ...` or `npm run import:gallery`)."
    );
  }

  const supabase = createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Importing ${CURATED_PHOTOS.length} curated photo${CURATED_PHOTOS.length === 1 ? "" : "s"} into "${ALBUM_TITLE}"...\n`);

  const albumId = await findOrCreateAlbum(supabase);

  let inserted = 0;
  let skipped = 0;
  let rehostFailed = 0;
  let insertFailed = 0;

  for (let i = 0; i < CURATED_PHOTOS.length; i++) {
    const { title, sourceUrl } = CURATED_PHOTOS[i];

    let exists: boolean;
    try {
      exists = await alreadyExists(supabase, albumId, title);
    } catch (err) {
      console.error(`  [error] ${title}: ${err instanceof Error ? err.message : String(err)}`);
      insertFailed++;
      continue;
    }

    if (exists) {
      console.log(`  [skipped, already exists] ${title}`);
      skipped++;
      continue;
    }

    const rehosted = await rehostImage(supabase, sourceUrl);
    if (!rehosted) {
      // Fatal for this row (not a fallback-to-original-URL case) — see
      // header comment: an un-rehosted static.wixstatic.com URL is not in
      // next.config.js's images.remotePatterns and would break next/image
      // rendering on the gallery page.
      console.error(`  [rehost failed, row skipped] ${title}`);
      rehostFailed++;
      continue;
    }

    const { error } = await supabase.from("gallery").insert({
      album_id: albumId,
      image_url: rehosted,
      title,
      display_order: i,
    });

    if (error) {
      console.error(`  [insert failed] ${title}: ${error.message}`);
      insertFailed++;
      continue;
    }

    console.log(`  [inserted] ${title}`);
    inserted++;
  }

  console.log("\n========================================================================");
  console.log("  SUMMARY");
  console.log("========================================================================");
  console.log(`  Album                    : ${ALBUM_TITLE} (id=${albumId})`);
  console.log(`  Inserted                 : ${inserted}`);
  console.log(`  Skipped (already exists) : ${skipped}`);
  console.log(`  Re-host failures         : ${rehostFailed}`);
  console.log(`  Insert failures          : ${insertFailed}`);
  console.log("========================================================================\n");

  if (rehostFailed > 0 || insertFailed > 0) {
    process.exitCode = 1;
  }
}

run().catch((err) => {
  console.error("\nImport failed:");
  console.error(err);
  process.exit(1);
});
