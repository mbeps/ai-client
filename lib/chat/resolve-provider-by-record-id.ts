import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiModel, aiProvider } from "@/drizzle/schema";
import { ProviderNotConfiguredError } from "@/lib/constants/errors";
import type { ResolvedProvider } from "@/types/provider/resolved-provider";
import { buildResolvedProvider } from "./build-resolved-provider";

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
  const rows = await db
    .select({
      provider: aiProvider,
      model: aiModel,
    })
    .from(aiModel)
    .innerJoin(aiProvider, eq(aiModel.providerId, aiProvider.id))
    .where(
      and(
        eq(aiModel.id, recordId),
        eq(aiModel.userId, userId),
        eq(aiModel.isEnabled, true),
        eq(aiProvider.isEnabled, true),
      ),
    );

  const row = rows[0];

  if (!row) {
    throw new ProviderNotConfiguredError(
      `Model record '${recordId}' is not configured or enabled.`,
    );
  }

  return buildResolvedProvider(row, userId);
}
