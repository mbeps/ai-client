import type { ResolvedProvider } from "@/types/provider/resolved-provider";
import { fetchProviderWithModel } from "./fetch-provider-with-model";

/**
 * Resolves a provider and model using the internal UUID (aiModel.id).
 * More reliable than resolving by modelId (string) when multiple providers offer the same model ID.
 * Checks that both provider and model are enabled before returning.
 *
 * @param userId - Authenticated user ID
 * @param recordId - UUID of the aiModel database record
 * @returns Resolved provider with initialized SDK and decrypted credentials
 * @throws {ProviderNotConfiguredError} When record not found or provider/model disabled
 * @throws {ProviderKeyCorruptedError} When credential decryption fails
 * @see resolveProvider for universal resolution by UUID or model ID
 * @author Maruf Bepary
 */
export async function resolveProviderByRecordId(
  userId: string,
  recordId: string,
): Promise<ResolvedProvider> {
  return fetchProviderWithModel(userId, { recordId });
}
