const PROFILE_URL_RULES = {
  linkedin_url: /^https:\/\/(www\.)?linkedin\.com\/in\/[A-Za-z0-9-]+\/?(?:\?[^#\s]*)?$/,
  instagram_url: /^https:\/\/(www\.)?instagram\.com\/[A-Za-z0-9._]+\/?(?:\?[^#\s]*)?$/,
  portfolio_url: /^https:\/\/[^/\s?#]+(?:[/?#][^\s]*)?$/i,
} as const;

type SocialField = keyof typeof PROFILE_URL_RULES;

export function validateMemberProfileLinks(payload: Record<string, unknown>) {
  for (const field of Object.keys(PROFILE_URL_RULES) as SocialField[]) {
    const value = payload[field];
    if (value === null || value === undefined || value === "") continue;
    if (typeof value !== "string" || !PROFILE_URL_RULES[field].test(value)) {
      return `Enter a valid ${field.replace("_url", "")} profile URL.`;
    }
  }

  return null;
}
