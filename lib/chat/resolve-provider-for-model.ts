import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiModel, aiProvider } from "@/drizzle/schema";
import { ROUTES } from "@/constants/routes";
import { ProviderNotConfiguredError } from "@/constants/errors";
import { isBlockedUrl } from "@/lib/mcp/url-guard";
import type { ResolvedProvider } from "@/types/provider/resolved-provider";
import { buildResolvedProvider } from "./build-resolved-provider";

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
  const rows = await db
    .select({
      provider: aiProvider,
      model: aiModel,
    })
    .from(aiModel)
    .innerJoin(aiProvider, eq(aiModel.providerId, aiProvider.id))
    .where(
      and(eq(aiModel.userId, userId), eq(aiModel.modelId, requestedModelId)),
    );

  const row = rows[0];

  if (!row) {
    throw new ProviderNotConfiguredError(
      `Model '${requestedModelId}' is not configured. Configure it in Settings → Providers.`,
    );
  }

  if (!row.provider.isEnabled) {
    throw new ProviderNotConfiguredError(
      `Provider '${row.provider.name}' is disabled. Enable it in Settings → Providers (${ROUTES.SETTINGS.PROVIDERS.path}).`,
    );
  }

  if (!row.model.isEnabled) {
    throw new ProviderNotConfiguredError(
      `Model '${row.model.label}' is disabled. Enable it in Settings → Providers.`,
    );
  }

  if (await isBlockedUrl(row.provider.baseUrl)) {
    throw new ProviderNotConfiguredError(
      `Provider '${row.provider.name}' URL is blocked by security policy.`,
    );
  }

  return buildResolvedProvider(row, userId);
}
