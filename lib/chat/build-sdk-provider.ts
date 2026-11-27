import { createAlibaba } from "@ai-sdk/alibaba";
import { createAnthropic } from "@ai-sdk/anthropic";
import { createBaseten } from "@ai-sdk/baseten";
import { createCerebras } from "@ai-sdk/cerebras";
import { createCohere } from "@ai-sdk/cohere";
import { createDeepInfra } from "@ai-sdk/deepinfra";
import { createDeepSeek } from "@ai-sdk/deepseek";
import { createFireworks } from "@ai-sdk/fireworks";
import { createGateway } from "@ai-sdk/gateway";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createGroq } from "@ai-sdk/groq";
import { createMiniMax } from "@ai-sdk/minimax";
import { createMistral } from "@ai-sdk/mistral";
import { createMoonshotAI } from "@ai-sdk/moonshotai";
import { createOpenAI } from "@ai-sdk/openai";
import { createPerplexity } from "@ai-sdk/perplexity";
import { createTogetherAI } from "@ai-sdk/togetherai";
import { createVoyage } from "@ai-sdk/voyage";
import { createXai } from "@ai-sdk/xai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { EmbeddingModel, LanguageModel } from "ai";
import { getProviderDefinition, type ProviderType } from "@/config/providers";
import { createReasoningNormalizingFetch } from "@/lib/chat/stream/reasoning-stream-parser";
import { ProviderNotConfiguredError } from "@/lib/error/provider-not-configured-error";
import type {
  ReasoningEffort,
  ReasoningEffortFormat,
} from "@/schemas/providers/provider-registry";
import type { SdkProvider } from "@/types/provider/resolved-provider";

type NativeProviderType = Exclude<
  ProviderType,
  "openai-compatible" | "llama-cpp"
>;

type NativeProviderOptions = {
  apiKey?: string;
  baseURL?: string;
  headers?: Record<string, string>;
  fetch?: typeof fetch;
};

type NativeProviderInstance = {
  languageModel: (modelId: string) => LanguageModel;
  embeddingModel?: (modelId: string) => EmbeddingModel;
};

type NativeProviderFactory = (
  options: NativeProviderOptions,
) => NativeProviderInstance;

const NATIVE_PROVIDER_FACTORIES: Record<
  NativeProviderType,
  NativeProviderFactory
> = {
  "ai-gateway": createGateway,
  xai: createXai,
  openai: createOpenAI,
  anthropic: createAnthropic,
  groq: createGroq,
  deepinfra: createDeepInfra,
  google: createGoogleGenerativeAI,
  mistral: createMistral,
  togetherai: createTogetherAI,
  cohere: createCohere,
  fireworks: createFireworks,
  voyage: createVoyage,
  deepseek: createDeepSeek,
  moonshotai: createMoonshotAI,
  alibaba: createAlibaba,
  minimax: createMiniMax,
  cerebras: createCerebras,
  perplexity: createPerplexity,
  baseten: createBaseten,
  openrouter: createOpenRouter,
};

export interface BuildSdkProviderInput {
  providerType?: ProviderType;
  providerName: string;
  baseUrl: string;
  apiKey: string | null;
  requiresKey?: boolean;
  headers: Record<string, string>;
  reasoningEffortFormat?: ReasoningEffortFormat;
  reasoningEffort?: ReasoningEffort;
  modelOptions?: Record<string, unknown> | null;
  fetch?: typeof fetch;
}

/**
 * Builds an initialized {@link SdkProvider} instance for the configured provider type.
 * Validates API key is present unless `requiresKey` is explicitly `false` (e.g. `llama-cpp`).
 * OpenAI-compatible and `llama-cpp` providers use `createReasoningNormalizingFetch`;
 * native AI SDK providers bypass it so non-OpenAI SSE streams are preserved intact.
 *
 * @param input - Provider configuration with type, name, baseUrl, apiKey, requiresKey, headers, and reasoning traits
 * @returns Unified {@link SdkProvider} exposing `.chat()` and `.embeddingModel()`
 * @throws {ProviderNotConfiguredError} When API key is missing or a model capability is unsupported
 * @author Maruf Bepary
 */
export function buildSdkProvider(input: BuildSdkProviderInput): SdkProvider {
  if (input.requiresKey !== false && !input.apiKey) {
    throw new ProviderNotConfiguredError(
      `API key not configured for provider: ${input.providerName}. Configure it in Settings → Providers.`,
    );
  }

  const providerType = input.providerType ?? "openai-compatible";
  const def = getProviderDefinition(providerType);

  if (providerType === "openai-compatible" || providerType === "llama-cpp") {
    const customFetch = createReasoningNormalizingFetch({
      reasoningEffortFormat: input.reasoningEffortFormat,
      reasoningEffort: input.reasoningEffort,
      modelOptions: input.modelOptions,
      baseFetch: input.fetch,
    });

    const sdk = createOpenAI({
      baseURL: input.baseUrl,
      apiKey: input.apiKey ?? undefined,
      headers: input.headers,
      fetch: customFetch,
    });

    return {
      chat: (modelId: string) => sdk.chat(modelId),
      embeddingModel: (modelId: string) => sdk.embeddingModel(modelId),
    };
  }

  const factory = NATIVE_PROVIDER_FACTORIES[providerType];
  const sdk = factory({
    apiKey: input.apiKey ?? undefined,
    baseURL: input.baseUrl || undefined,
    headers: input.headers,
    fetch: input.fetch,
  });

  return {
    chat: (modelId: string): LanguageModel => {
      if (!def.supportsChat) {
        throw new ProviderNotConfiguredError(
          `Provider '${input.providerName}' (${def.label}) does not support chat models.`,
        );
      }
      return sdk.languageModel(modelId);
    },
    embeddingModel: (modelId: string): EmbeddingModel => {
      if (!def.supportsEmbeddings || typeof sdk.embeddingModel !== "function") {
        throw new ProviderNotConfiguredError(
          `Provider '${input.providerName}' (${def.label}) does not support embedding models.`,
        );
      }
      return sdk.embeddingModel(modelId);
    },
  };
}
