import { describe, expect, it, beforeAll } from "vitest";
import { decryptFromCookieValue, encryptToCookieValue } from "./tokenCrypto";

beforeAll(() => {
  // 32-byte key as 64 hex chars — matches the shape documented in
  // 11_ENV_AND_SETUP.md / TOKEN_ENCRYPTION_KEY.
  process.env.TOKEN_ENCRYPTION_KEY =
    "3897c7c6b1e006080194ca92b543c5245a8313d63caf2e3b2ec722f478135359"; // pragma: allowlist secret
});

describe("token cookie encryption", () => {
  it("round-trips a plaintext payload", () => {
    const payload = JSON.stringify({ accessToken: "abc", refreshToken: "xyz" });
    const encrypted = encryptToCookieValue(payload);
    expect(encrypted).not.toContain(payload);
    expect(decryptFromCookieValue(encrypted)).toBe(payload);
  });

  it("produces a different ciphertext for the same plaintext each time", () => {
    const payload = "same-input";
    const a = encryptToCookieValue(payload);
    const b = encryptToCookieValue(payload);
    expect(a).not.toBe(b); // random IV per call
  });

  it("returns null for a tampered value instead of throwing", () => {
    const encrypted = encryptToCookieValue("secret");
    const tampered = encrypted.slice(0, -2) + "zz";
    expect(decryptFromCookieValue(tampered)).toBeNull();
  });

  it("returns null for a malformed value", () => {
    expect(decryptFromCookieValue("not-a-valid-cookie-value")).toBeNull();
  });
});
