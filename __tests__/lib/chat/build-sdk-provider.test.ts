import { beforeEach, describe, expect, it, vi } from "vitest";
import { PROVIDER_CATALOG, type ProviderType } from "@/config/providers";
import { ProviderNotConfiguredError } from "@/lib/error/provider-not-configured-error";

const mockLanguageModel = vi.hoisted(() =>
  vi.fn((id: string) => ({ modelId: id, kind: "language" })),
);
const mockChatModel = vi.hoisted(() =>
  vi.fn((id: string) => ({ modelId: id, kind: "chat" })),
);
const mockEmbeddingModel = vi.hoisted(() =>
  vi.fn((id: string) => ({ modelId: id, kind: "embedding" })),
);
const mockReasoningFetch = vi.hoisted(() => vi.fn());

const mockOpenAIFactory = vi.hoisted(() =>
  vi.fn(() => ({
    chat: mockChatModel,
    languageModel: mockLanguageModel,
    embeddingModel: mockEmbeddingModel,
  })),
);

const mockNativeFactories = vi.hoisted(() => ({
  gateway: vi.fn(() => ({
    languageModel: mockLanguageModel,
    embeddingModel: mockEmbeddingModel,
  })),
  xai: vi.fn(() => ({
    languageModel: mockLanguageModel,
    embeddingModel: mockEmbeddingModel,
  })),
  anthropic: vi.fn(() => ({
    languageModel: mockLanguageModel,
    embeddingModel: mockEmbeddingModel,
  })),
  groq: vi.fn(() => ({
    languageModel: mockLanguageModel,
    embeddingModel: mockEmbeddingModel,
  })),
  deepinfra: vi.fn(() => ({
    languageModel: mockLanguageModel,
    embeddingModel: mockEmbeddingModel,
  })),
  google: vi.fn(() => ({
    languageModel: mockLanguageModel,
    embeddingModel: mockEmbeddingModel,
  })),
  mistral: vi.fn(() => ({
    languageModel: mockLanguageModel,
    embeddingModel: mockEmbeddingModel,
  })),
  togetherai: vi.fn(() => ({
    languageModel: mockLanguageModel,
    embeddingModel: mockEmbeddingModel,
  })),
  cohere: vi.fn(() => ({
    languageModel: mockLanguageModel,
    embeddingModel: mockEmbeddingModel,
  })),
  fireworks: vi.fn(() => ({
    languageModel: mockLanguageModel,
    embeddingModel: mockEmbeddingModel,
  })),
  voyage: vi.fn(() => ({
    languageModel: mockLanguageModel,
    embeddingModel: mockEmbeddingModel,
  })),
  deepseek: vi.fn(() => ({
    languageModel: mockLanguageModel,
    embeddingModel: mockEmbeddingModel,
  })),
  moonshotai: vi.fn(() => ({
    languageModel: mockLanguageModel,
  })),
  alibaba: vi.fn(() => ({
    languageModel: mockLanguageModel,
  })),
  minimax: vi.fn(() => ({
    languageModel: mockLanguageModel,
    embeddingModel: mockEmbeddingModel,
  })),
  cerebras: vi.fn(() => ({
    languageModel: mockLanguageModel,
    embeddingModel: mockEmbeddingModel,
  })),
  perplexity: vi.fn(() => ({
    languageModel: mockLanguageModel,
    embeddingModel: mockEmbeddingModel,
  })),
  baseten: vi.fn(() => ({
    languageModel: mockLanguageModel,
    embeddingModel: mockEmbeddingModel,
  })),
  openrouter: vi.fn(() => ({
    languageModel: mockLanguageModel,
  })),
}));

vi.mock("@/lib/chat/stream/reasoning-stream-parser", () => ({
  createReasoningNormalizingFetch: vi.fn(() => mockReasoningFetch),
}));

vi.mock("@ai-sdk/openai", () => ({ createOpenAI: mockOpenAIFactory }));
vi.mock("@ai-sdk/gateway", () => ({ createGateway: mockNativeFactories.gateway }));
vi.mock("@ai-sdk/xai", () => ({ createXai: mockNativeFactories.xai }));
vi.mock("@ai-sdk/anthropic", () => ({
  createAnthropic: mockNativeFactories.anthropic,
}));
vi.mock("@ai-sdk/groq", () => ({ createGroq: mockNativeFactories.groq }));
vi.mock("@ai-sdk/deepinfra", () => ({
  createDeepInfra: mockNativeFactories.deepinfra,
}));
vi.mock("@ai-sdk/google", () => ({
  createGoogleGenerativeAI: mockNativeFactories.google,
}));
vi.mock("@ai-sdk/mistral", () => ({
  createMistral: mockNativeFactories.mistral,
}));
vi.mock("@ai-sdk/togetherai", () => ({
  createTogetherAI: mockNativeFactories.togetherai,
}));
vi.mock("@ai-sdk/cohere", () => ({ createCohere: mockNativeFactories.cohere }));
vi.mock("@ai-sdk/fireworks", () => ({
  createFireworks: mockNativeFactories.fireworks,
}));
vi.mock("@ai-sdk/voyage", () => ({ createVoyage: mockNativeFactories.voyage }));
vi.mock("@ai-sdk/deepseek", () => ({
  createDeepSeek: mockNativeFactories.deepseek,
}));
vi.mock("@ai-sdk/moonshotai", () => ({
  createMoonshotAI: mockNativeFactories.moonshotai,
}));
vi.mock("@ai-sdk/alibaba", () => ({
  createAlibaba: mockNativeFactories.alibaba,
}));
vi.mock("@ai-sdk/minimax", () => ({
  createMiniMax: mockNativeFactories.minimax,
}));
vi.mock("@ai-sdk/cerebras", () => ({
  createCerebras: mockNativeFactories.cerebras,
}));
vi.mock("@ai-sdk/perplexity", () => ({
  createPerplexity: mockNativeFactories.perplexity,
}));
vi.mock("@ai-sdk/baseten", () => ({
  createBaseten: mockNativeFactories.baseten,
}));
vi.mock("@openrouter/ai-sdk-provider", () => ({
  createOpenRouter: mockNativeFactories.openrouter,
}));

import { buildSdkProvider } from "@/lib/chat/build-sdk-provider";
import { createReasoningNormalizingFetch } from "@/lib/chat/stream/reasoning-stream-parser";

const FACTORY_BY_NATIVE_TYPE: Record<
  Exclude<ProviderType, "openai-compatible" | "llama-cpp">,
  ReturnType<typeof vi.fn>
> = {
  "ai-gateway": mockNativeFactories.gateway,
  xai: mockNativeFactories.xai,
  openai: mockOpenAIFactory,
  anthropic: mockNativeFactories.anthropic,
  groq: mockNativeFactories.groq,
  deepinfra: mockNativeFactories.deepinfra,
  google: mockNativeFactories.google,
  mistral: mockNativeFactories.mistral,
  togetherai: mockNativeFactories.togetherai,
  cohere: mockNativeFactories.cohere,
  fireworks: mockNativeFactories.fireworks,
  voyage: mockNativeFactories.voyage,
  deepseek: mockNativeFactories.deepseek,
  moonshotai: mockNativeFactories.moonshotai,
  alibaba: mockNativeFactories.alibaba,
  minimax: mockNativeFactories.minimax,
  cerebras: mockNativeFactories.cerebras,
  perplexity: mockNativeFactories.perplexity,
  baseten: mockNativeFactories.baseten,
  openrouter: mockNativeFactories.openrouter,
};

describe("buildSdkProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("builds openai-compatible provider by default with reasoning fetch", () => {
    const provider = buildSdkProvider({
      providerName: "Custom OpenAI",
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-test",
      headers: { "X-Test": "1" },
    });

    expect(createReasoningNormalizingFetch).toHaveBeenCalledTimes(1);
    expect(mockOpenAIFactory).toHaveBeenCalledWith({
      baseURL: "https://api.openai.com/v1",
      apiKey: "sk-test",
      headers: { "X-Test": "1" },
      fetch: mockReasoningFetch,
    });

    expect(provider.chat("gpt-4o")).toEqual({
      modelId: "gpt-4o",
      kind: "chat",
    });
    expect(provider.embeddingModel("text-embedding-3-small")).toEqual({
      modelId: "text-embedding-3-small",
      kind: "embedding",
    });
  });

  it("throws when apiKey missing and requiresKey is true (default)", () => {
    expect(() =>
      buildSdkProvider({
        providerName: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: null,
        headers: {},
      }),
    ).toThrow(ProviderNotConfiguredError);
  });

  it("throws when apiKey missing and requiresKey explicitly true", () => {
    expect(() =>
      buildSdkProvider({
        providerName: "openai",
        baseUrl: "https://api.openai.com/v1",
        apiKey: null,
        headers: {},
        requiresKey: true,
      }),
    ).toThrow(ProviderNotConfiguredError);
  });

  it("does not throw for keyless llama-cpp provider (requiresKey=false)", () => {
    const provider = buildSdkProvider({
      providerType: "llama-cpp",
      providerName: "llama.cpp",
      baseUrl: "http://localhost:8080/v1",
      apiKey: null,
      headers: {},
      requiresKey: false,
    });

    expect(createReasoningNormalizingFetch).toHaveBeenCalledTimes(1);
    expect(mockOpenAIFactory).toHaveBeenCalledWith({
      baseURL: "http://localhost:8080/v1",
      apiKey: undefined,
      headers: {},
      fetch: mockReasoningFetch,
    });
    expect(provider.chat("llama-3.2")).toEqual({
      modelId: "llama-3.2",
      kind: "chat",
    });
  });

  it.each(
    PROVIDER_CATALOG.filter(
      (def) => def.id !== "openai-compatible" && def.id !== "llama-cpp",
    ).map((def) => [def.id, def] as const),
  )(
    "dispatches native provider %s without reasoning-normalizing fetch",
    (providerType, def) => {
      const customFetch = vi.fn() as unknown as typeof fetch;
      const provider = buildSdkProvider({
        providerType,
        providerName: def.label,
        baseUrl: def.defaultBaseUrl,
        apiKey: "sk-native",
        headers: { "X-Custom": "val" },
        fetch: customFetch,
      });

      const factory =
        FACTORY_BY_NATIVE_TYPE[
          providerType as Exclude<
            ProviderType,
            "openai-compatible" | "llama-cpp"
          >
        ];

      expect(createReasoningNormalizingFetch).not.toHaveBeenCalled();
      expect(factory).toHaveBeenCalledWith({
        apiKey: "sk-native",
        baseURL: def.defaultBaseUrl,
        headers: { "X-Custom": "val" },
        fetch: customFetch,
      });

      if (def.supportsChat) {
        expect(provider.chat("test-model")).toEqual({
          modelId: "test-model",
          kind: "language",
        });
      } else {
        expect(() => provider.chat("test-model")).toThrow(
          ProviderNotConfiguredError,
        );
      }

      if (def.supportsEmbeddings && providerType !== "alibaba") {
        expect(provider.embeddingModel("embed-model")).toEqual({
          modelId: "embed-model",
          kind: "embedding",
        });
      } else {
        expect(() => provider.embeddingModel("embed-model")).toThrow(
          ProviderNotConfiguredError,
        );
      }
    },
  );

  it("passes baseURL as undefined when baseUrl is empty for native providers", () => {
    buildSdkProvider({
      providerType: "anthropic",
      providerName: "Anthropic",
      baseUrl: "",
      apiKey: "sk-ant",
      headers: {},
    });

    expect(mockNativeFactories.anthropic).toHaveBeenCalledWith({
      apiKey: "sk-ant",
      baseURL: undefined,
      headers: {},
      fetch: undefined,
    });
  });

  it("allows keyless native provider when requiresKey is false", () => {
    buildSdkProvider({
      providerType: "anthropic",
      providerName: "Anthropic Proxy",
      baseUrl: "https://proxy.example.com/v1",
      apiKey: null,
      requiresKey: false,
      headers: {},
    });

    expect(mockNativeFactories.anthropic).toHaveBeenCalledWith({
      apiKey: undefined,
      baseURL: "https://proxy.example.com/v1",
      headers: {},
      fetch: undefined,
    });
  });
});
