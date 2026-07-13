import crypto from "crypto";

// Reversible encryption for member passwords, so the approval email can include
// the plaintext password the member chose at signup. bcrypt (password_hash) stays
// the source of truth for login checks; this is a separate, decryptable copy.
const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const secret = process.env.PASSWORD_ENC_KEY || process.env.JWT_SECRET || "fallback_secret_robocon_2026_!@#";
  return crypto.createHash("sha256").update(secret).digest();
}

export function encryptPassword(plain: string): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return [iv.toString("base64"), authTag.toString("base64"), ciphertext.toString("base64")].join(".");
}

export function decryptPassword(enc: string): string | null {
  try {
    const [ivB64, tagB64, dataB64] = enc.split(".");
    const decipher = crypto.createDecipheriv(ALGO, getKey(), Buffer.from(ivB64, "base64"));
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const plain = Buffer.concat([decipher.update(Buffer.from(dataB64, "base64")), decipher.final()]);
    return plain.toString("utf8");
  } catch {
    return null;
  }
}
