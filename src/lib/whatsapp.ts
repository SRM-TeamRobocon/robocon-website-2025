// Builds a wa.me deep link that opens a chat with a prefilled message.
// wa.me needs the full international number with no leading zero, spaces, or "+" -
// just digits. Recruit phone numbers are stored as bare 10-digit Indian mobile
// numbers (validated at registration, see recruit-validation.ts), so the country
// code is prepended here rather than asked of every caller.
export function buildWhatsAppLink(phone: string, message: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length !== 10) return null;
  return `https://wa.me/91${digits}?text=${encodeURIComponent(message)}`;
}
