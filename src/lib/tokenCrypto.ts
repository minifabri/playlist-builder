import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Symmetric encryption for Spotify tokens held in the session cookie
 * (07_ARCHITECTURE.md — "encrypt tokens at rest"; 11_ENV_AND_SETUP.md —
 * TOKEN_ENCRYPTION_KEY). AES-256-GCM: a random 12-byte IV per encryption,
 * auth tag appended, everything base64url-encoded into one cookie-safe
 * string as `<iv>.<tag>.<ciphertext>`.
 *
 * Server-only — do not import from a "use client" component.
 */

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex) {
    throw new Error("Missing required environment variable: TOKEN_ENCRYPTION_KEY");
  }
  const key = Buffer.from(hex, "hex");
  if (key.length !== 32) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY must be a 64-character hex string (32 bytes).",
    );
  }
  return key;
}

function toBase64Url(buf: Buffer): string {
  return buf.toString("base64url");
}

function fromBase64Url(str: string): Buffer {
  return Buffer.from(str, "base64url");
}

export function encryptToCookieValue(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return [toBase64Url(iv), toBase64Url(tag), toBase64Url(ciphertext)].join(".");
}

export function decryptFromCookieValue(value: string): string | null {
  try {
    const key = getKey();
    const [ivPart, tagPart, ciphertextPart] = value.split(".");
    if (!ivPart || !tagPart || !ciphertextPart) return null;
    const iv = fromBase64Url(ivPart);
    const tag = fromBase64Url(tagPart);
    const ciphertext = fromBase64Url(ciphertextPart);
    const decipher = createDecipheriv(ALGO, key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  } catch {
    // Wrong/rotated key, tampered value, or malformed cookie — treat as
    // "not authenticated" rather than throwing, so a stale cookie degrades
    // to "please reconnect" instead of a 500.
    return null;
  }
}
