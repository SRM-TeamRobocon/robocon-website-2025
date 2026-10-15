/**
 * Timezone-aware date helpers for Bazaar.
 * Always operates in Indian Standard Time (Asia/Kolkata).
 */

export function todayIST(): string {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return formatter.format(new Date());
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "—";
  try {
    const [year, month, day] = dateString.split("T")[0].split("-").map(Number);
    if (!year || !month || !day) return dateString;
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.toLocaleDateString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "UTC",
    });
  } catch {
    return dateString;
  }
}

export function formatDateTime(isoString: string | null | undefined): string {
  if (!isoString) return "—";
  try {
    const d = new Date(isoString);
    return d.toLocaleString("en-IN", {
      day: "numeric",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Kolkata",
    });
  } catch {
    return isoString;
  }
}

export function daysBetween(fromStr: string, toStr: string): number {
  const from = new Date(fromStr + "T00:00:00Z");
  const to = new Date(toStr + "T00:00:00Z");
  const diffMs = to.getTime() - from.getTime();
  return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

export function isOverdue(status: string, expectedReturnDate: string): boolean {
  if (status !== "issued") return false;
  const today = todayIST();
  return expectedReturnDate < today;
}

export function getDaysOverdue(expectedReturnDate: string): number {
  const today = todayIST();
  if (expectedReturnDate >= today) return 0;
  return daysBetween(expectedReturnDate, today);
}
