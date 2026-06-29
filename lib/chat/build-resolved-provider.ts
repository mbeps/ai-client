import { parseProviderHeaders } from "@/lib/actions/providers/utils";
import { logger } from "@/lib/logger";
import type { AiModelRow } from "@/types/provider/ai-model-row";
import type { AiProviderRow } from "@/types/provider/ai-provider-row";
import type { ResolvedProvider } from "@/types/provider/resolved-provider";
import { decryptProviderField } from "./decrypt-provider-field";
import { buildSdkProvider } from "./build-sdk-provider";

/**
 * Constructs a ResolvedProvider by decrypting provider credentials and initializing the SDK.
 * Handles decryption of API key and custom headers, validates URL for SSRF, and logs resolution.
 *
 * @param row - Database query result with provider and model rows
 * @param userId - Authenticated user ID for audit logging
 * @returns Complete ResolvedProvider with initialized SDK, decrypted key, and model metadata
 * @throws {ProviderKeyCorruptedError} When credential decryption fails
 * @throws {ProviderNotConfiguredError} When URL is blocked by security policy
 * @author Maruf Bepary
 */
export function buildResolvedProvider(
  row: { provider: AiProviderRow; model: AiModelRow },
  userId: string,
): ResolvedProvider {
  const decryptedApiKey = decryptProviderField(
    row.provider.apiKey,
    null,
    "apiKey",
    row.provider.id,
    userId,
  );
  const decryptedHeaders = decryptProviderField(
    row.provider.headers,
    "{}",
    "headers",
    row.provider.id,
    userId,
  );

  const headers = parseProviderHeaders(decryptedHeaders);

  logger.info(
    "Provider resolved for model",
    { modelId: row.model.modelId, provider: row.provider.name },
    userId,
  );

  return {
    sdkProvider: buildSdkProvider({
      providerName: row.provider.name,
      baseUrl: row.provider.baseUrl,
      apiKey: decryptedApiKey,
      headers,
    }),
    modelId: row.model.modelId,
    providerRow: row.provider,
    modelRow: row.model,
    apiKey: decryptedApiKey,
  };
}
