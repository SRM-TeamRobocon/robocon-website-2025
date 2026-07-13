export type ContentResource =
  | "members"
  | "projects"
  | "achievements"
  | "events"
  | "alumni"
  | "gallery"
  | "contact_submissions";

export type ContentFieldType = "text" | "textarea" | "url" | "number" | "date" | "datetime" | "boolean" | "tags";

export type ContentField = {
  name: string;
  label: string;
  type: ContentFieldType;
  required?: boolean;
  readonly?: boolean;
};

export type ContentResourceConfig = {
  table: ContentResource;
  label: string;
  pluralLabel: string;
  primaryField: string;
  orderBy: string;
  ascending: boolean;
  readonly?: boolean;
  fields: ContentField[];
};

export const CONTENT_RESOURCES: Record<ContentResource, ContentResourceConfig> = {
  members: {
    table: "members",
    label: "Member",
    pluralLabel: "Members",
    primaryField: "name",
    orderBy: "display_order",
    ascending: true,
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "role", label: "Role", type: "text", required: true },
      { name: "domain", label: "Domain", type: "text" },
      { name: "year", label: "Year", type: "text" },
      { name: "photo_url", label: "Photo URL", type: "url" },
      { name: "linkedin_url", label: "LinkedIn URL", type: "url" },
      { name: "instagram_url", label: "Instagram URL", type: "url" },
      { name: "facebook_url", label: "Facebook URL", type: "url" },
      { name: "is_active", label: "Active", type: "boolean" },
      { name: "display_order", label: "Display Order", type: "number" },
    ],
  },
  projects: {
    table: "projects",
    label: "Project",
    pluralLabel: "Projects",
    primaryField: "title",
    orderBy: "display_order",
    ascending: true,
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea" },
      { name: "abstract", label: "Abstract", type: "textarea" },
      { name: "cover_image_url", label: "Cover Image URL", type: "url" },
      { name: "cover_width", label: "Cover Image Width (px)", type: "number" },
      { name: "cover_height", label: "Cover Image Height (px)", type: "number" },
      { name: "gallery_urls", label: "Gallery Image URLs", type: "tags" },
      { name: "shortkey", label: "Short Teaser", type: "textarea" },
      { name: "tech_stack", label: "Tech Stack", type: "tags" },
      { name: "year", label: "Year", type: "text" },
      { name: "competition", label: "Competition", type: "text" },
      { name: "display_order", label: "Display Order", type: "number" },
    ],
  },
  achievements: {
    table: "achievements",
    label: "Achievement",
    pluralLabel: "Achievements",
    primaryField: "title",
    orderBy: "display_order",
    ascending: true,
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea" },
      { name: "abstract", label: "Abstract", type: "textarea" },
      { name: "cover_image_url", label: "Cover Image URL", type: "url" },
      { name: "cover_width", label: "Cover Image Width (px)", type: "number" },
      { name: "cover_height", label: "Cover Image Height (px)", type: "number" },
      { name: "gallery_urls", label: "Gallery Image URLs", type: "tags" },
      { name: "achievement_date", label: "Achievement Date", type: "date" },
      { name: "competition", label: "Competition", type: "text" },
      { name: "rank", label: "Rank", type: "text" },
      { name: "display_order", label: "Display Order", type: "number" },
    ],
  },
  events: {
    table: "events",
    label: "Event",
    pluralLabel: "Events",
    primaryField: "title",
    orderBy: "event_date",
    ascending: false,
    fields: [
      { name: "title", label: "Title", type: "text", required: true },
      { name: "description", label: "Description", type: "textarea" },
      { name: "abstract", label: "Abstract", type: "textarea" },
      { name: "cover_image_url", label: "Cover Image URL", type: "url" },
      { name: "cover_width", label: "Cover Image Width (px)", type: "number" },
      { name: "cover_height", label: "Cover Image Height (px)", type: "number" },
      { name: "gallery_urls", label: "Gallery Image URLs", type: "tags" },
      { name: "event_date", label: "Event Date", type: "datetime" },
      { name: "location", label: "Location", type: "text" },
      { name: "registration_link", label: "Registration Link", type: "url" },
      { name: "is_upcoming", label: "Upcoming", type: "boolean" },
      { name: "display_order", label: "Display Order", type: "number" },
    ],
  },
  alumni: {
    table: "alumni",
    label: "Alumnus",
    pluralLabel: "Alumni",
    primaryField: "name",
    orderBy: "display_order",
    ascending: true,
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "domain", label: "Domain", type: "text" },
      { name: "designation", label: "Designation", type: "text" },
      { name: "about", label: "About", type: "textarea" },
      { name: "description", label: "Description", type: "textarea" },
      { name: "profession", label: "Profession", type: "text" },
      { name: "batch", label: "Batch", type: "text" },
      { name: "photo_url", label: "Photo URL", type: "url" },
      { name: "linkedin_url", label: "LinkedIn URL", type: "url" },
      { name: "instagram_url", label: "Instagram URL", type: "url" },
      { name: "facebook_url", label: "Facebook URL", type: "url" },
      { name: "display_order", label: "Display Order", type: "number" },
    ],
  },
  gallery: {
    table: "gallery",
    label: "Gallery Image",
    pluralLabel: "Gallery",
    primaryField: "title",
    orderBy: "uploaded_at",
    ascending: false,
    fields: [
      { name: "image_url", label: "Image URL", type: "url", required: true },
      { name: "title", label: "Title", type: "text" },
      { name: "category", label: "Category", type: "text" },
      { name: "content", label: "Content", type: "textarea" },
      { name: "display_order", label: "Display Order", type: "number" },
    ],
  },
  contact_submissions: {
    table: "contact_submissions",
    label: "Message",
    pluralLabel: "Messages",
    primaryField: "email",
    orderBy: "submitted_at",
    ascending: false,
    readonly: true,
    fields: [
      { name: "name", label: "Name", type: "text", readonly: true },
      { name: "email", label: "Email", type: "text", readonly: true },
      { name: "message", label: "Message", type: "textarea", readonly: true },
      { name: "submitted_at", label: "Submitted At", type: "datetime", readonly: true },
      { name: "is_read", label: "Read", type: "boolean" },
    ],
  },
};

export function getContentResource(resource: string): ContentResourceConfig | null {
  if (resource in CONTENT_RESOURCES) {
    return CONTENT_RESOURCES[resource as ContentResource];
  }

  return null;
}

export function contentResourceList() {
  return Object.values(CONTENT_RESOURCES);
}

function cleanString(value: unknown) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

export function normalizePayload(config: ContentResourceConfig, body: Record<string, unknown>) {
  const payload: Record<string, unknown> = {};

  for (const field of config.fields) {
    if (field.readonly && field.name !== "is_read") continue;
    if (!(field.name in body)) continue;

    const value = body[field.name];

    if (field.type === "number") {
      payload[field.name] = value === "" || value === null || value === undefined ? 0 : Number(value);
      continue;
    }

    if (field.type === "boolean") {
      payload[field.name] = Boolean(value);
      continue;
    }

    if (field.type === "tags") {
      payload[field.name] = Array.isArray(value)
        ? value.map((item) => String(item).trim()).filter(Boolean)
        : String(value ?? "")
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean);
      continue;
    }

    if (field.type === "datetime") {
      const normalized = cleanString(value);
      payload[field.name] = typeof normalized === "string" ? new Date(normalized).toISOString() : normalized;
      continue;
    }

    payload[field.name] = cleanString(value);
  }

  return payload;
}
