export const BAZAAR_NAME = "Siesed Bazaar";

export function getBazaarConfig() {
  const leadEmailsEnv = process.env.BAZAAR_LEAD_EMAILS || "";
  const leadEmails = leadEmailsEnv
    .split(",")
    .map((e) => e.trim())
    .filter(Boolean);

  const fallbackEmail = process.env.ORGANIZER_EMAIL || process.env.SMTP_EMAIL || "";
  if (leadEmails.length === 0 && fallbackEmail) {
    leadEmails.push(fallbackEmail);
  }

  const maxActiveRequests = Number(process.env.BAZAAR_MAX_ACTIVE_REQUESTS) || 99999;
  const maxLoanDays = Number(process.env.BAZAAR_MAX_LOAN_DAYS) || 365;

  return {
    name: BAZAAR_NAME,
    leadEmails,
    maxActiveRequests,
    maxLoanDays,
  };
}
