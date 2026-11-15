/**
 * SIESED Bazaar Component Photo Registry
 * Provides high-clarity, pure white-background product photos for lab components.
 */

export const BAZAAR_LOCAL_IMAGES: Record<string, string> = {
  "5v single channel relay module": "/images/bazaar/5v-single-channel-relay.jpg",
  "cytron 20a single channel motor driver": "/images/bazaar/cytron-20a-motor-driver.jpg",
  "digital multimeter": "/images/bazaar/digital-multimeter.jpg",
  "full size breadboard (830 points)": "/images/bazaar/full-size-breadboard-830.jpg",
  "header pin strip (40-pin male)": "/images/bazaar/header-pin-strip-40pin.jpg",
  "lipo battery 3s 11.1v / lab test pack": "/images/bazaar/lipo-battery-3s-11v.jpg",
  "male to female jumper wires (40 pcs)": "/images/bazaar/male-to-female-jumper-wires.jpg",
  "male to male jumper wires (40 pcs)": "/images/bazaar/male-to-male-jumper-wires.jpg",
  "prorange dc geared motor 458 rpm": "/images/bazaar/prorange-dc-geared-motor.jpg",
  "st-link v2 programmer / debugger": "/images/bazaar/st-link-v2-programmer.jpg",
};

// Aliases for user-friendly partial name matching
const BAZAAR_ALIASES: Array<{ pattern: RegExp; file: string }> = [
  { pattern: /multimeter/i, file: "/images/bazaar/digital-multimeter.jpg" },
  { pattern: /st-?link/i, file: "/images/bazaar/st-link-v2-programmer.jpg" },
  { pattern: /male.*female.*jumper/i, file: "/images/bazaar/male-to-female-jumper-wires.jpg" },
  { pattern: /male.*male.*jumper/i, file: "/images/bazaar/male-to-male-jumper-wires.jpg" },
  { pattern: /header.*pin/i, file: "/images/bazaar/header-pin-strip-40pin.jpg" },
  { pattern: /breadboard/i, file: "/images/bazaar/full-size-breadboard-830.jpg" },
  { pattern: /relay/i, file: "/images/bazaar/5v-single-channel-relay.jpg" },
  { pattern: /cytron|motor.*driver/i, file: "/images/bazaar/cytron-20a-motor-driver.jpg" },
  { pattern: /geared.*motor|prorange.*motor/i, file: "/images/bazaar/prorange-dc-geared-motor.jpg" },
  { pattern: /lipo|battery.*3s/i, file: "/images/bazaar/lipo-battery-3s-11v.jpg" },
];

/**
 * Returns a high-clarity photo URL for a given bazaar item.
 * Prioritizes local `/images/bazaar/...` bundled image if item matches a known inventory name,
 * and falls back to item.image_url for custom/user-uploaded components.
 */
export function getBazaarItemPhoto(
  item?: { name?: string | null; image_url?: string | null } | null
): string | null {
  if (!item) return null;

  // 1. Direct match in local catalog
  if (item.name) {
    const normalized = item.name.trim().toLowerCase();
    if (BAZAAR_LOCAL_IMAGES[normalized]) {
      return BAZAAR_LOCAL_IMAGES[normalized];
    }
  }

  // 2. Exact image_url if provided
  if (item.image_url && item.image_url.trim()) {
    return item.image_url.trim();
  }

  // 3. Keyword / alias match
  if (item.name) {
    const normalized = item.name.trim().toLowerCase();
    for (const alias of BAZAAR_ALIASES) {
      if (alias.pattern.test(normalized)) {
        return alias.file;
      }
    }
  }

  return null;
}
