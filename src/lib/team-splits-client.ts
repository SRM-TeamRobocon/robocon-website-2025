export async function splitRequest<T>(url: string, options?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...options });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error || "Could not complete the request. Please try again.");
  if (!body) throw new Error("Unexpected response. Please try again.");
  return body as T;
}
