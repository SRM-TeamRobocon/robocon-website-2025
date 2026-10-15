import { z } from "zod";

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const requestItemEntrySchema = z
  .object({
    item_id: z.string().uuid("Invalid item ID").optional().nullable(),
    custom_item_name: z.string().trim().max(120).optional().nullable(),
    quantity: z.coerce.number().int().positive("Quantity must be at least 1"),
  })
  .refine(
    (data) => Boolean(data.item_id || (data.custom_item_name && data.custom_item_name.trim().length > 0)),
    {
      message: "Please select an existing component or specify an unlisted component name",
      path: ["custom_item_name"],
    }
  );

export const createRequestSchema = z
  .object({
    items: z.array(requestItemEntrySchema).min(1).optional(),
    item_id: z.string().uuid("Invalid item ID").optional().nullable(),
    custom_item_name: z.string().trim().max(120).optional().nullable(),
    quantity: z.coerce.number().int().positive("Quantity must be at least 1").optional(),
    purpose: z.string().trim().min(2, "Purpose must be at least 2 characters").max(500, "Purpose too long"),
    project_name: z.string().trim().max(120, "Project name too long").optional().nullable(),
    taking_date: z.string().regex(dateRegex, "Taking date must be in YYYY-MM-DD format"),
    expected_return_date: z.string().regex(dateRegex, "Expected return date must be in YYYY-MM-DD format"),
    usage_location: z.enum(["in_lab", "outside"]).default("in_lab"),
    location_details: z.string().trim().max(200, "Location details too long").optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.items && data.items.length > 0) return true;
      return Boolean(data.item_id || (data.custom_item_name && data.custom_item_name.trim().length > 0));
    },
    {
      message: "Please select an existing component or specify an unlisted component name",
      path: ["custom_item_name"],
    }
  );

export const createItemSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "Name too long"),
  description: z.string().trim().max(1000, "Description too long").optional().nullable(),
  category_id: z.string().uuid("Invalid category ID").optional().nullable(),
  location: z.string().trim().max(100, "Location too long").optional().nullable(),
  image_url: z.string().url("Invalid image URL").optional().nullable().or(z.literal("")),
  total_quantity: z.coerce.number().int().min(0, "Total quantity cannot be negative"),
  low_stock_threshold: z.coerce.number().int().min(0, "Threshold cannot be negative").default(0),
});

export const updateItemSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(120, "Name too long").optional(),
  description: z.string().trim().max(1000).optional().nullable(),
  category_id: z.string().uuid("Invalid category ID").optional().nullable(),
  location: z.string().trim().max(100).optional().nullable(),
  image_url: z.string().url("Invalid image URL").optional().nullable().or(z.literal("")),
  low_stock_threshold: z.coerce.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export const stockAdjustSchema = z.object({
  total_delta: z.coerce.number().int(),
  damaged_delta: z.coerce.number().int().default(0),
  note: z.string().trim().max(500).optional().nullable(),
}).refine(
  (data) => data.total_delta >= 0 || (data.note && data.note.trim().length > 0),
  { message: "A note is required when decreasing total stock", path: ["note"] }
);

export const categorySchema = z.object({
  name: z.string().trim().min(1, "Category name is required").max(60, "Category name too long"),
});

export const approveRequestSchema = z.object({
  note: z.string().trim().max(500).optional().nullable(),
  issue: z.boolean().default(false),
});

export const rejectRequestSchema = z.object({
  note: z.string().trim().min(3, "Rejection reason must be at least 3 characters").max(500),
});

export const returnRequestSchema = z.object({
  good: z.coerce.number().int().min(0),
  damaged: z.coerce.number().int().min(0).default(0),
  lost: z.coerce.number().int().min(0).default(0),
  note: z.string().trim().max(500).optional().nullable(),
});

export const cancelRequestSchema = z.object({
  note: z.string().trim().max(500).optional().nullable(),
});
