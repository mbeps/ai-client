import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock encryption helpers to control decrypt behavior
const encryptMock = vi.hoisted(() => vi.fn((val: string) => `enc:${val}`));
const decryptMock = vi.hoisted(() =>
  vi.fn((val: string) => {
    if (val.startsWith("enc:")) return val.slice(4);
    if (val === "corrupt-error") throw new Error("Decryption failed");
    if (val === "corrupt-string") throw "Raw string decryption failure";
    return val;
  }),
);

vi.mock("@/lib/encryption/encrypt", () => ({
  encrypt: encryptMock,
}));

vi.mock("@/lib/encryption/decrypt", () => ({
  decrypt: decryptMock,
}));

import { ProviderKeyCorruptedError } from "@/lib/errors";
import {
  decodeProviderRecord,
  normaliseProviderApiKey,
  parseProviderHeaders,
  serialiseProviderHeaders,
  toEncryptedProviderValues,
} from "@/lib/providers/provider-utils";
import type { AiProviderRow } from "@/types/provider/ai-provider-row";

describe("lib/providers/provider-utils", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("normaliseProviderApiKey", () => {
    it("returns trimmed string or null", () => {
      expect(normaliseProviderApiKey("  sk-test  ")).toBe("sk-test");
      expect(normaliseProviderApiKey("")).toBe(null);
      expect(normaliseProviderApiKey("   ")).toBe(null);
      expect(normaliseProviderApiKey(null)).toBe(null);
      expect(normaliseProviderApiKey(undefined)).toBe(null);
    });
  });

  describe("serialiseProviderHeaders", () => {
    it("serializes valid headers and filters empty keys/values", () => {
      expect(serialiseProviderHeaders(undefined)).toBe(null);
      expect(serialiseProviderHeaders({})).toBe(null);
      expect(serialiseProviderHeaders({ "": "val", " ": "val2", key: "  " })).toBe(null);

      const result = serialiseProviderHeaders({
        Authorization: "Bearer token",
        "X-Custom": "val",
        Empty: "",
      });
      expect(JSON.parse(result!)).toEqual({
        Authorization: "Bearer token",
        "X-Custom": "val",
      });
    });
  });

  describe("parseProviderHeaders", () => {
    it("parses valid JSON string into headers object", () => {
      expect(parseProviderHeaders(null)).toEqual({});
      expect(parseProviderHeaders("")).toEqual({});
      expect(parseProviderHeaders("{invalid json")).toEqual({});
      expect(parseProviderHeaders("null")).toEqual({});
      expect(parseProviderHeaders("123")).toEqual({});
      expect(parseProviderHeaders("[]")).toEqual({});

      // Filters non-string values
      const parsed = parseProviderHeaders(
        JSON.stringify({ valid: "yes", invalidNum: 123, invalidObj: {} }),
      );
      expect(parsed).toEqual({ valid: "yes" });
    });
  });

  describe("toEncryptedProviderValues", () => {
    it("encrypts normalized apiKey and serialised headers", () => {
      const res = toEncryptedProviderValues({
        apiKey: " sk-123 ",
        headers: { "X-Key": "secret" },
      });
      expect(res.apiKey).toBe("enc:sk-123");
      expect(res.headers).toContain("enc:");
    });

    it("returns null when inputs are empty or missing", () => {
      const res = toEncryptedProviderValues({});
      expect(res.apiKey).toBe(null);
      expect(res.headers).toBe(null);
    });
  });

  describe("decodeProviderRecord", () => {
    const baseRow: AiProviderRow = {
      id: "prov-1",
      userId: "user-1",
      name: "OpenAI",
      baseUrl: "https://api.openai.com",
      apiKey: null,
      headers: null,
      isEnabled: true,
      requiresKey: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it("decodes record with null credentials", () => {
      const res = decodeProviderRecord(baseRow);
      expect(res.apiKey).toBe(null);
      expect(res.headers).toEqual({});
      expect(res.row).toBe(baseRow);
    });

    it("decodes encrypted apiKey and headers", () => {
      const row: AiProviderRow = {
        ...baseRow,
        apiKey: "enc:sk-live",
        headers: `enc:${JSON.stringify({ "X-Custom": "header-value" })}`,
      };
      const res = decodeProviderRecord(row);
      expect(res.apiKey).toBe("sk-live");
      expect(res.headers).toEqual({ "X-Custom": "header-value" });
    });

    it("throws ProviderKeyCorruptedError when apiKey decryption fails (with Error)", () => {
      const row: AiProviderRow = {
        ...baseRow,
        apiKey: "corrupt-error",
      };
      expect(() => decodeProviderRecord(row)).toThrow(ProviderKeyCorruptedError);
    });

    it("throws ProviderKeyCorruptedError when apiKey decryption fails (with non-Error)", () => {
      const row: AiProviderRow = {
        ...baseRow,
        apiKey: "corrupt-string",
      };
      expect(() => decodeProviderRecord(row)).toThrow(ProviderKeyCorruptedError);
    });

    it("throws ProviderKeyCorruptedError when headers decryption fails (with Error)", () => {
      const row: AiProviderRow = {
        ...baseRow,
        headers: "corrupt-error",
      };
      expect(() => decodeProviderRecord(row)).toThrow(ProviderKeyCorruptedError);
    });

    it("throws ProviderKeyCorruptedError when headers decryption fails (with non-Error)", () => {
      const row: AiProviderRow = {
        ...baseRow,
        headers: "corrupt-string",
      };
      expect(() => decodeProviderRecord(row)).toThrow(ProviderKeyCorruptedError);
    });
  });
});

