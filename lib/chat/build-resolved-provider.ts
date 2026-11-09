import { buildSdkProvider } from "@/lib/chat/build-sdk-provider";
import { decryptProviderField } from "@/lib/chat/decrypt-provider-field";
import { getLogger } from "@/lib/logger";
import { parseProviderHeaders } from "@/lib/providers/parse-provider-headers";
import type { ReasoningEffortFormat } from "@/schemas/providers/provider-registry";
import type { AiModelRow } from "@/types/provider/ai-model-row";
import type { AiProviderRow } from "@/types/provider/ai-provider-row";
import type { ResolvedProvider } from "@/types/provider/resolved-provider";

const log = getLogger(["app", "chat", "provider"]);

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

  let parsedModelOptions: Record<string, unknown> | null = null;
  if (row.model.modelOptions) {
    try {
      const parsed = JSON.parse(row.model.modelOptions);
      if (
        typeof parsed === "object" &&
        parsed !== null &&
        !Array.isArray(parsed)
      ) {
        parsedModelOptions = parsed as Record<string, unknown>;
      }
    } catch {
      log.warn("Failed to parse modelOptions for model {modelId}", {
        modelId: row.model.modelId,
      });
    }
  }

  log.info("Provider resolved for model {modelId} ({provider})", {
    modelId: row.model.modelId,
    provider: row.provider.name,
  });

  return {
    sdkProvider: buildSdkProvider({
      providerName: row.provider.name,
      baseUrl: row.provider.baseUrl,
      apiKey: decryptedApiKey,
      requiresKey: row.provider.requiresKey,
      headers,
      reasoningEffortFormat:
        (row.model.reasoningEffortFormat as ReasoningEffortFormat) ?? "none",
      modelOptions: parsedModelOptions,
    }),
    modelId: row.model.modelId,
    providerRow: row.provider,
    modelRow: row.model,
    apiKey: decryptedApiKey,
  };
}
