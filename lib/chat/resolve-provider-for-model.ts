import type { ResolvedProvider } from "@/types/provider/resolved-provider";
import { fetchProviderWithModel } from "./fetch-provider-with-model";

/**
 * Resolves an AI provider and model for a chat request by looking up user settings.
 * Decrypts stored API keys and provider credentials, validates they exist,
 * and initializes an OpenAI-compatible SDK provider instance.
 * Throws ProviderNotConfiguredError if provider/model not found or API key missing.
 *
 * @param userId - Authenticated user ID
 * @param requestedModelId - Model ID to resolve (e.g., "openai/gpt-4o")
 * @returns Resolved provider with initialized SDK, model row, and decrypted API key
 * @throws {ProviderNotConfiguredError} When provider/model not found or not configured
 * @throws {ProviderKeyCorruptedError} When API key decryption fails
 * @see {@link lib/utils/encryption.ts} for decryption mechanism
 * @author Maruf Bepary
 */
export async function resolveProviderForModel(
  userId: string,
  requestedModelId: string,
): Promise<ResolvedProvider> {
  return fetchProviderWithModel(userId, { modelId: requestedModelId });
}
