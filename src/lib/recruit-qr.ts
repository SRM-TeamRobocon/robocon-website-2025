import "server-only";

import { createHmac, timingSafeEqual } from "crypto";

export type QRPayload = {
  rid: string;
  cid: string;
};

// Fail closed in production. With a committed fallback secret, anyone who learns a
// recruit's UUID could forge a valid QR and mark attendance as them.
function qrSecret(): string {
  const configured = process.env.QR_SECRET;
  if (!configured) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("QR_SECRET is not set - refusing to sign or verify recruit QR codes.");
    }
    console.warn("[recruit-qr] QR_SECRET is unset - using an insecure development fallback.");
    return "fallback_qr_secret_!@#";
  }
  return configured;
}

function computeSig(rid: string, cid: string): string {
  return createHmac("sha256", qrSecret())
    .update(`${rid}:${cid}`)
    .digest("hex");
}

export function signQR(rid: string, cid: string): string {
  const sig = computeSig(rid, cid);
  return Buffer.from(JSON.stringify({ rid, cid, sig })).toString("base64url");
}

export function verifyQR(payload: string): QRPayload | null {
  try {
    const { rid, cid, sig } = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    if (typeof rid !== "string" || typeof cid !== "string" || typeof sig !== "string") return null;

    const expected = computeSig(rid, cid);
    const expectedBuf = Buffer.from(expected, "hex");
    const sigBuf = Buffer.from(sig, "hex");
    if (expectedBuf.length !== sigBuf.length || !timingSafeEqual(expectedBuf, sigBuf)) return null;

    return { rid, cid };
  } catch {
    return null;
  }
}
