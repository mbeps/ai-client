import type { EmbeddingModel, LanguageModel } from "ai";
import type { AiModelRow } from "@/types/provider/ai-model-row";
import type { AiProviderRow } from "@/types/provider/ai-provider-row";

/**
 * Unified AI SDK provider surface consumed by chat, workflow, translation, and RAG callers.
 */
export type SdkProvider = {
  chat: (modelId: string) => LanguageModel;
  embeddingModel: (modelId: string) => EmbeddingModel;
};

/**
 * Resolved AI provider with decrypted credentials and initialized SDK.
 * Contains the provider configuration, model details, and ready-to-use AI SDK instance.
 * Returned by all resolve functions after credential decryption and validation.
 *
 * @see resolveProviderForModel for resolution by model ID
 * @see resolveProvider for universal resolution
 * @author Maruf Bepary
 */
export type ResolvedProvider = {
  sdkProvider: SdkProvider;
  modelId: string;
  providerRow: AiProviderRow;
  modelRow: AiModelRow;
  apiKey: string | null;
};
