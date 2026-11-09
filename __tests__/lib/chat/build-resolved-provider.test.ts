import { describe, expect, it, vi } from "vitest";
import { buildResolvedProvider } from "@/lib/chat/build-resolved-provider";

vi.mock("@/lib/chat/decrypt-provider-field", () => ({
  decryptProviderField: vi.fn((val) => (val ? "decrypted" : null)),
}));

vi.mock("@/lib/providers/parse-provider-headers", () => ({
  parseProviderHeaders: vi.fn(() => ({ "X-Custom": "header" })),
}));

vi.mock("@/lib/chat/build-sdk-provider", () => ({
  buildSdkProvider: vi.fn(() => ({ languageModel: vi.fn() })),
}));

describe("buildResolvedProvider", () => {
  it("constructs and returns resolved provider with decrypted credentials and sdkProvider", () => {
    const providerRow: any = {
      id: "prov-1",
      name: "OpenAI",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "enc-key",
      headers: "enc-headers",
      requiresKey: true,
    };
    const modelRow: any = {
      id: "model-1",
      modelId: "gpt-4o",
    };

    const result = buildResolvedProvider(
      { provider: providerRow, model: modelRow },
      "user-1",
    );

    expect(result.modelId).toBe("gpt-4o");
    expect(result.providerRow).toBe(providerRow);
    expect(result.modelRow).toBe(modelRow);
    expect(result.apiKey).toBe("decrypted");
    expect(result.sdkProvider).toBeDefined();
  });

  it("parses valid modelOptions and passes reasoningEffortFormat", () => {
    const providerRow: any = {
      id: "prov-1",
      name: "OpenRouter",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: "enc-key",
      headers: "enc-headers",
      requiresKey: true,
    };
    const modelRow: any = {
      id: "model-1",
      modelId: "deepseek-r1",
      reasoningEffortFormat: "openrouter",
      modelOptions: JSON.stringify({ enable_thinking: true }),
    };

    const result = buildResolvedProvider(
      { provider: providerRow, model: modelRow },
      "user-1",
    );

    expect(result.modelId).toBe("deepseek-r1");
  });

  it("handles malformed modelOptions gracefully without throwing", () => {
    const providerRow: any = {
      id: "prov-1",
      name: "OpenRouter",
      baseUrl: "https://openrouter.ai/api/v1",
      apiKey: "enc-key",
      headers: "enc-headers",
      requiresKey: true,
    };
    const modelRow: any = {
      id: "model-1",
      modelId: "deepseek-r1",
      reasoningEffortFormat: "openrouter",
      modelOptions: "{ invalid json",
    };

    const result = buildResolvedProvider(
      { provider: providerRow, model: modelRow },
      "user-1",
    );

    expect(result.modelId).toBe("deepseek-r1");
  });
});

