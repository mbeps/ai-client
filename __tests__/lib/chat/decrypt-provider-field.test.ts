import { describe, expect, it, vi } from "vitest";
import { ProviderKeyCorruptedError } from "@/constants/errors";
import { decryptProviderField } from "@/lib/chat/decrypt-provider-field";
import { decrypt } from "@/lib/encryption/decrypt";

vi.mock("@/lib/encryption/decrypt", () => ({
  decrypt: vi.fn(),
}));

describe("decryptProviderField", () => {
  it("returns fallback when value is null or empty string", () => {
    expect(decryptProviderField(null, "default", "apiKey", "p1")).toBe(
      "default",
    );
    expect(decryptProviderField("", "default", "apiKey", "p1")).toBe("default");
    expect(decrypt).not.toHaveBeenCalled();
  });

  it("returns decrypted value when decrypt succeeds", () => {
    vi.mocked(decrypt).mockReturnValueOnce("decrypted-secret");
    const result = decryptProviderField(
      "encrypted-blob",
      null,
      "apiKey",
      "p1",
      "user-1",
    );
    expect(result).toBe("decrypted-secret");
    expect(decrypt).toHaveBeenCalledWith("encrypted-blob");
  });

  it("throws ProviderKeyCorruptedError when decryption throws an Error instance", () => {
    vi.mocked(decrypt).mockImplementationOnce(() => {
      throw new Error("Invalid MAC");
    });

    expect(() =>
      decryptProviderField("bad-blob", null, "apiKey", "p1", "user-1"),
    ).toThrow(ProviderKeyCorruptedError);
  });

  it("throws ProviderKeyCorruptedError when decryption throws a non-Error", () => {
    vi.mocked(decrypt).mockImplementationOnce(() => {
      throw "string-error";
    });

    expect(() =>
      decryptProviderField("bad-blob", null, "apiKey", "p1", "user-1"),
    ).toThrow(ProviderKeyCorruptedError);
  });
});
