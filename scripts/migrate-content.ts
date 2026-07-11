import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";
import { events, projects, achievements1 } from "../src/constants/constants";
import photoNames from "../public/gallery/photoData";

const PUBLIC_DIR = path.join(__dirname, "..", "public");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY must be set in .env.local");
}

const supabase = createClient(url, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });

const uploadCache = new Map<string, string | null>();

async function uploadOnce(localPath: string, bucket: string, folder: string): Promise<string | null> {
  const cacheKey = `${bucket}/${localPath}`;
  if (uploadCache.has(cacheKey)) return uploadCache.get(cacheKey)!;

  const absPath = path.join(PUBLIC_DIR, localPath.replace(/^\//, ""));
  if (!fs.existsSync(absPath)) {
    console.warn(`  [missing file] ${localPath}`);
    uploadCache.set(cacheKey, null);
    return null;
  }

  const bytes = fs.readFileSync(absPath);
  const ext = path.extname(absPath).slice(1) || "bin";
  const contentType =
    ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/jpeg";
  const storagePath = `${folder}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(bucket).upload(storagePath, bytes, { contentType, upsert: false });
  if (error) {
    console.warn(`  [upload failed] ${localPath}: ${error.message}`);
    uploadCache.set(cacheKey, null);
    return null;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  uploadCache.set(cacheKey, data.publicUrl);
  return data.publicUrl;
}

function findPhotoByName(name: string, dir: string): string | null {
  const absDir = path.join(PUBLIC_DIR, dir);
  if (!fs.existsSync(absDir)) return null;
  const normalized = name.trim().toLowerCase();
  const files = fs.readdirSync(absDir);
  const match = files.find((f) => path.parse(f).name.trim().toLowerCase() === normalized);
  return match ? path.posix.join(dir, match) : null;
}

const TEAM_SHEET_URL =
  "https://script.google.com/macros/s/AKfycbyxSIPqvt_RxMKvEjaHUUZLt5sV9Yc1UKxOKqGLXlyDX8oKPWgg8Ci_4DiDIctmkj-kOw/exec";

async function uploadFromUrl(sourceUrl: string, bucket: string, folder: string): Promise<string | null> {
  const cacheKey = `${bucket}/${sourceUrl}`;
  if (uploadCache.has(cacheKey)) return uploadCache.get(cacheKey)!;

  const res = await fetch(sourceUrl);
  if (!res.ok) {
    console.warn(`  [fetch failed] ${sourceUrl}: ${res.status}`);
    uploadCache.set(cacheKey, null);
    return null;
  }

  const bytes = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || "image/jpeg";
  const ext = contentType.includes("png") ? "png" : contentType.includes("webp") ? "webp" : "jpg";
  const storagePath = `${folder}/${crypto.randomUUID()}.${ext}`;

  const { error } = await supabase.storage.from(bucket).upload(storagePath, bytes, { contentType, upsert: false });
  if (error) {
    console.warn(`  [upload failed] ${sourceUrl}: ${error.message}`);
    uploadCache.set(cacheKey, null);
    return null;
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(storagePath);
  uploadCache.set(cacheKey, data.publicUrl);
  return data.publicUrl;
}

async function migrateMembers() {
  console.log("\n=== members (live Google Sheet feed) ===");
  const res = await fetch(TEAM_SHEET_URL, { redirect: "follow" });
  if (!res.ok) throw new Error(`team sheet fetch failed: ${res.status}`);
  const data = await res.json();

  let photosFound = 0;
  const rows: any[] = [];

  for (const domain of Object.keys(data)) {
    let order = 0;
    for (const member of data[domain]) {
      const name = String(member.Name || "").trim();
      if (!name) continue;

      let photoUrl: string | null = null;
      if (member.Image) {
        photoUrl = await uploadFromUrl(member.Image, "member-photos", "members");
      } else {
        const photoRel = findPhotoByName(name, "team/photos11");
        if (photoRel) photoUrl = await uploadOnce(photoRel, "member-photos", "members");
      }
      if (photoUrl) photosFound++;

      rows.push({
        name,
        role: member.Designation || "Member",
        domain,
        photo_url: photoUrl,
        linkedin_url: member.Linkedin || null,
        instagram_url: member.Instagram || null,
        facebook_url: member.Facebook || null,
        is_active: true,
        display_order: order++,
      });
    }
  }

  const { error } = await supabase.from("members").insert(rows);
  if (error) throw new Error(`members insert failed: ${error.message}`);
  console.log(`  inserted ${rows.length} rows, ${photosFound} photos matched (${rows.length - photosFound} without a photo)`);
}

async function migrateAlumni() {
  console.log("\n=== alumni ===");
  const data = JSON.parse(fs.readFileSync(path.join(PUBLIC_DIR, "alumni/alumniData.json"), "utf8"));
  let photosFound = 0;
  const rows: any[] = [];

  for (const rawBatch of Object.keys(data)) {
    const batch = rawBatch.replace(/"/g, "");
    let order = 0;
    for (const alum of data[rawBatch]) {
      const name = String(alum.Name || "").trim();
      if (!name) continue;

      const photoRel = findPhotoByName(name, "alumni/photos");
      let photoUrl: string | null = null;
      if (photoRel) {
        photoUrl = await uploadOnce(photoRel, "member-photos", "alumni");
        if (photoUrl) photosFound++;
      }

      rows.push({
        name,
        domain: alum.Domain || null,
        designation: alum.Designation || null,
        about: alum.About || null,
        description: alum.Description || null,
        profession: alum.Profession || null,
        batch,
        photo_url: photoUrl,
        linkedin_url: alum.Linkedin || null,
        instagram_url: alum.Instagram || null,
        facebook_url: alum.Facebook || null,
        display_order: order++,
      });
    }
  }

  const { error } = await supabase.from("alumni").insert(rows);
  if (error) throw new Error(`alumni insert failed: ${error.message}`);
  console.log(`  inserted ${rows.length} rows, ${photosFound} photos matched (${rows.length - photosFound} without a photo)`);
}

async function migrateProjects() {
  console.log("\n=== projects ===");
  const rows: any[] = [];
  let order = 0;

  for (const project of projects as any[]) {
    const coverUrl = project.coverImage ? await uploadOnce(project.coverImage, "project-covers", "projects") : null;
    const galleryUrls: string[] = [];
    for (const img of project.gallery || []) {
      const uploaded = await uploadOnce(img, "project-covers", "projects");
      if (uploaded) galleryUrls.push(uploaded);
    }

    rows.push({
      title: project.name,
      description: project.description || null,
      abstract: project.abstract || null,
      cover_image_url: coverUrl,
      gallery_urls: galleryUrls.length ? galleryUrls : null,
      shortkey: project.shortkey || null,
      display_order: order++,
    });
  }

  const { error } = await supabase.from("projects").insert(rows);
  if (error) throw new Error(`projects insert failed: ${error.message}`);
  console.log(`  inserted ${rows.length} rows`);
}

async function migrateAchievements() {
  console.log("\n=== achievements ===");
  const rows: any[] = [];
  let order = 0;

  for (const achievement of achievements1 as any[]) {
    const coverUrl = achievement.coverImage
      ? await uploadOnce(achievement.coverImage, "achievement-images", "achievements")
      : null;
    const galleryUrls: string[] = [];
    for (const img of achievement.gallery || []) {
      const uploaded = await uploadOnce(img, "achievement-images", "achievements");
      if (uploaded) galleryUrls.push(uploaded);
    }

    rows.push({
      title: achievement.name,
      description: achievement.description || null,
      abstract: achievement.abstract || null,
      cover_image_url: coverUrl,
      gallery_urls: galleryUrls.length ? galleryUrls : null,
      display_order: order++,
    });
  }

  const { error } = await supabase.from("achievements").insert(rows);
  if (error) throw new Error(`achievements insert failed: ${error.message}`);
  console.log(`  inserted ${rows.length} rows`);
}

async function migrateEvents() {
  console.log("\n=== events ===");
  const rows: any[] = [];
  let order = 0;

  for (const event of events as any[]) {
    const coverUrl = event.coverImage ? await uploadOnce(event.coverImage, "event-posters", "events") : null;
    const galleryUrls: string[] = [];
    for (const img of event.gallery || []) {
      const uploaded = await uploadOnce(img, "event-posters", "events");
      if (uploaded) galleryUrls.push(uploaded);
    }

    rows.push({
      title: event.name,
      description: event.description || null,
      abstract: event.abstract || null,
      cover_image_url: coverUrl,
      gallery_urls: galleryUrls.length ? galleryUrls : null,
      is_upcoming: false,
      display_order: order++,
    });
  }

  const { error } = await supabase.from("events").insert(rows);
  if (error) throw new Error(`events insert failed: ${error.message}`);
  console.log(`  inserted ${rows.length} rows`);
}

async function migrateGallery() {
  console.log("\n=== gallery ===");
  const carouselData = JSON.parse(
    fs.readFileSync(path.join(__dirname, "..", "src/app/gallery/carousel-data.json"), "utf8")
  );

  const rows: any[] = [];
  let order = 0;

  for (const item of carouselData as any[]) {
    const imageUrl = await uploadOnce(item.src, "gallery", "gallery");
    if (!imageUrl) continue;
    rows.push({
      image_url: imageUrl,
      title: item.title || null,
      category: item.category || null,
      content: item.content || null,
      display_order: order++,
    });
  }

  for (const photoName of photoNames) {
    const rel = `gallery/photos/${photoName}`;
    const imageUrl = await uploadOnce(rel, "gallery", "gallery");
    if (!imageUrl) continue;
    rows.push({
      image_url: imageUrl,
      title: null,
      category: null,
      content: null,
      display_order: order++,
    });
  }

  const { error } = await supabase.from("gallery").insert(rows);
  if (error) throw new Error(`gallery insert failed: ${error.message}`);
  console.log(`  inserted ${rows.length} rows`);
}

async function run() {
  await migrateMembers();
  await migrateAlumni();
  await migrateProjects();
  await migrateAchievements();
  await migrateEvents();
  await migrateGallery();
  console.log("\nDone.");
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
