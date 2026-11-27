import { describe, expect, it } from "vitest";
import {
  buildDiscoveryHeaders,
  buildModelsEndpointUrl,
  extractDiscoveredModelIds,
} from "@/lib/providers/provider-discovery";

describe("provider-discovery", () => {
  describe("buildDiscoveryHeaders", () => {
    it("builds Bearer auth header for openai-compatible and official bearer providers", () => {
      expect(
        buildDiscoveryHeaders("openai", "sk-123", { "X-Custom": "val" }),
      ).toEqual({
        Authorization: "Bearer sk-123",
        "X-Custom": "val",
      });
    });

    it("omits Authorization header when apiKey is null or empty for bearer providers", () => {
      expect(buildDiscoveryHeaders("llama-cpp", null)).toEqual({});
      expect(buildDiscoveryHeaders("openai-compatible", "", { "X-A": "1" })).toEqual({
        "X-A": "1",
      });
    });

    it("falls back to bearer auth for null, undefined, or unknown provider types", () => {
      expect(buildDiscoveryHeaders(null, "sk-abc")).toEqual({
        Authorization: "Bearer sk-abc",
      });
      expect(buildDiscoveryHeaders(undefined, "sk-abc")).toEqual({
        Authorization: "Bearer sk-abc",
      });
      expect(buildDiscoveryHeaders("unknown-legacy", "sk-abc")).toEqual({
        Authorization: "Bearer sk-abc",
      });
    });

    it("builds Anthropic headers and lets custom headers override anthropic-version", () => {
      expect(buildDiscoveryHeaders("anthropic", "ant-key")).toEqual({
        "x-api-key": "ant-key",
        "anthropic-version": "2023-06-01",
      });

      expect(
        buildDiscoveryHeaders("anthropic", "ant-key", {
          "anthropic-version": "2024-01-01",
          "X-Extra": "yes",
        }),
      ).toEqual({
        "x-api-key": "ant-key",
        "anthropic-version": "2024-01-01",
        "X-Extra": "yes",
      });

      expect(buildDiscoveryHeaders("anthropic", null, { "X-Extra": "yes" })).toEqual({
        "X-Extra": "yes",
      });
    });

    it("builds Google x-goog-api-key header and omits when apiKey is missing", () => {
      expect(
        buildDiscoveryHeaders("google", "goog-key", { "X-Org": "acme" }),
      ).toEqual({
        "x-goog-api-key": "goog-key",
        "X-Org": "acme",
      });

      expect(buildDiscoveryHeaders("google", null)).toEqual({});
    });
  });

  describe("buildModelsEndpointUrl", () => {
    it("trims trailing slash and appends modelsPath", () => {
      expect(
        buildModelsEndpointUrl("https://api.openai.com/v1/", "openai"),
      ).toBe("https://api.openai.com/v1/models");
      expect(
        buildModelsEndpointUrl("https://api.anthropic.com/v1", "anthropic"),
      ).toBe("https://api.anthropic.com/v1/models");
    });

    it("falls back to default provider definition when type is omitted or unknown", () => {
      expect(buildModelsEndpointUrl("http://localhost:8080/v1/", null)).toBe(
        "http://localhost:8080/v1/models",
      );
      expect(buildModelsEndpointUrl("http://localhost:8080/v1", undefined)).toBe(
        "http://localhost:8080/v1/models",
      );
    });
  });

  describe("extractDiscoveredModelIds", () => {
    it("extracts openai format entries from payload.data and preserves raw metadata", () => {
      const payload = {
        data: [
          { id: "gpt-4o", object: "model" },
          { id: "openrouter/r1", supported_parameters: ["include_reasoning"] },
          { object: "model" },
        ],
      };

      expect(extractDiscoveredModelIds(payload, "openai")).toEqual([
        { id: "gpt-4o", raw: { id: "gpt-4o", object: "model" } },
        {
          id: "openrouter/r1",
          raw: {
            id: "openrouter/r1",
            supported_parameters: ["include_reasoning"],
          },
        },
        { id: undefined, raw: { object: "model" } },
      ]);
    });

    it("extracts models format entries, stripping Google models/ prefix while preserving Cohere and AI Gateway IDs", () => {
      const payload = {
        models: [
          { name: "models/gemini-2.5-flash", displayName: "Gemini 2.5 Flash" },
          { name: "command-a-03-2025", context_length: 256000 },
          { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4" },
          { displayName: "Missing Name" },
        ],
      };

      expect(extractDiscoveredModelIds(payload, "models")).toEqual([
        {
          id: "gemini-2.5-flash",
          raw: {
            name: "models/gemini-2.5-flash",
            displayName: "Gemini 2.5 Flash",
          },
        },
        {
          id: "command-a-03-2025",
          raw: { name: "command-a-03-2025", context_length: 256000 },
        },
        {
          id: "anthropic/claude-sonnet-4",
          raw: { id: "anthropic/claude-sonnet-4", name: "Claude Sonnet 4" },
        },
        {
          id: undefined,
          raw: { displayName: "Missing Name" },
        },
      ]);
    });

    it("handles null and primitive entries inside data or models arrays without throwing", () => {
      expect(
        extractDiscoveredModelIds({ data: [null, "bad", 42, { id: "gpt-4o" }] }, "openai"),
      ).toEqual([
        { id: undefined, raw: {} },
        { id: undefined, raw: {} },
        { id: undefined, raw: {} },
        { id: "gpt-4o", raw: { id: "gpt-4o" } },
      ]);

      expect(
        extractDiscoveredModelIds(
          { models: [null, "bad", { id: "openai/gpt-4o" }] },
          "models",
        ),
      ).toEqual([
        { id: undefined, raw: {} },
        { id: undefined, raw: {} },
        { id: "openai/gpt-4o", raw: { id: "openai/gpt-4o" } },
      ]);
    });

    it("returns empty array when payload is null, non-object, or missing array field", () => {
      expect(extractDiscoveredModelIds(null, "openai")).toEqual([]);
      expect(extractDiscoveredModelIds(undefined, "models")).toEqual([]);
      expect(extractDiscoveredModelIds({}, "openai")).toEqual([]);
      expect(extractDiscoveredModelIds({}, "models")).toEqual([]);
      expect(extractDiscoveredModelIds({ data: "invalid" }, "openai")).toEqual([]);
      expect(extractDiscoveredModelIds({ models: "invalid" }, "models")).toEqual([]);
    });
  });
});
