import { createOpenAI } from "@ai-sdk/openai";
import type { AiModelRow } from "@/types/provider/ai-model-row";
import type { AiProviderRow } from "@/types/provider/ai-provider-row";

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
  sdkProvider: ReturnType<typeof createOpenAI>;
  modelId: string;
  providerRow: AiProviderRow;
  modelRow: AiModelRow;
  apiKey: string | null;
};
