import { ProviderNotConfiguredError } from "@/lib/constants/errors";
import type { ResolvedProvider } from "@/types/provider/resolved-provider";
import { resolveProviderByRecordId } from "./resolve-provider-by-record-id";
import { resolveProviderForModel } from "./resolve-provider-for-model";

/**
 * Universal resolver that tries to find a model by record ID (UUID) first,
 * then falls back to resolving by modelId (slug) for backward compatibility.
 * Detects UUID format and attempts UUID lookup before slug-based lookup.
 *
 * @param userId - Authenticated user ID
 * @param modelIdentifier - Either a UUID (aiModel.id) or model slug (e.g., "openai/gpt-4o")
 * @returns Resolved provider with initialized SDK and decrypted credentials
 * @throws {ProviderNotConfiguredError} When model not found or provider not configured
 * @throws {ProviderKeyCorruptedError} When credential decryption fails
 * @see resolveProviderForModel for slug-only resolution
 * @see resolveProviderByRecordId for UUID-only resolution
 * @author Maruf Bepary
 */
export async function resolveProvider(
  userId: string,
  modelIdentifier: string,
): Promise<ResolvedProvider> {
  const isUuid =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      modelIdentifier,
    );

  if (isUuid) {
    try {
      return await resolveProviderByRecordId(userId, modelIdentifier);
    } catch (err) {
      // If it looks like a UUID but isn't in our DB as an ID,
      // maybe it's actually a model slug that happens to look like a UUID
      // or we just want to fall through.
      if (!(err instanceof ProviderNotConfiguredError)) {
        throw err;
      }
    }
  }

  return resolveProviderForModel(userId, modelIdentifier);
}
