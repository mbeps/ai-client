vi.mock("@/config/env", () => ({
  env: {
    ENCRYPTION_SECRET: "test-secret-key-123",
  },
}));

import { describe, expect, it } from "vitest";
import { decrypt } from "@/lib/encryption/decrypt";
import { encrypt } from "@/lib/encryption/encrypt";

describe("Encryption / Decryption", () => {
  it("encrypts and decrypts plaintext correctly", () => {
    const original = "my-secret-api-key-12345";
    const encrypted = encrypt(original);

    expect(encrypted).toBeDefined();
    expect(encrypted.split(":")).toHaveLength(3);

    const decrypted = decrypt(encrypted);
    expect(decrypted).toBe(original);
  });

  it("throws on invalid encrypted hash format", () => {
    expect(() => decrypt("invalid-hash")).toThrow(
      "Invalid encrypted text format",
    );
  });

  it("throws on tampered or invalid decryption", () => {
    const encrypted = encrypt("secret");
    const [iv, tag, content] = encrypted.split(":");
    const tampered = `${iv}:${tag}:${content}00`;

    expect(() => decrypt(tampered)).toThrow();
  });
});
