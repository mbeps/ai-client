import { and, eq, type SQL } from "drizzle-orm";
import { ProviderNotConfiguredError } from "@/constants/errors";
import { db } from "@/drizzle/db";
import { aiModel, aiProvider } from "@/drizzle/schema";
import { isBlockedUrl } from "@/lib/mcp/url-guard/is-blocked-url";
import type { ResolvedProvider } from "@/types/provider/resolved-provider";
import { buildResolvedProvider } from "./build-resolved-provider";

/**
 * Internal helper to fetch a provider and model pair, validate status and security,
 * and return a fully initialized ResolvedProvider.
 *
 * @param userId - Authenticated user ID
 * @param criteria - Criteria to fetch by: recordId (UUID) or modelId (slug)
 * @param additionalFilters - Optional additional filters for the query (e.g., modelType)
 * @returns Resolved provider with initialized SDK and decrypted credentials
 * @throws {ProviderNotConfiguredError} When provider/model not found or disabled
 * @author Maruf Bepary
 */
export async function fetchProviderWithModel(
  userId: string,
  criteria: { recordId?: string; modelId?: string },
  additionalFilters: SQL[] = [],
): Promise<ResolvedProvider> {
  const whereClause: SQL[] = [eq(aiModel.userId, userId), ...additionalFilters];

  if (criteria.recordId) {
    whereClause.push(eq(aiModel.id, criteria.recordId));
  } else if (criteria.modelId) {
    whereClause.push(eq(aiModel.modelId, criteria.modelId));
  } else {
    throw new Error(
      "Either recordId or modelId must be provided to fetchProviderWithModel",
    );
  }

  const rows = await db
    .select({
      provider: aiProvider,
      model: aiModel,
    })
    .from(aiModel)
    .innerJoin(aiProvider, eq(aiModel.providerId, aiProvider.id))
    .where(and(...whereClause));

  const row = rows[0];

  if (!row) {
    throw new ProviderNotConfiguredError(
      "Model is not configured or not found.",
    );
  }

  // 1. Availability Checks
  if (!row.provider.isEnabled || !row.model.isEnabled) {
    throw new ProviderNotConfiguredError(
      `Provider '${row.provider.name}' or model '${row.model.label}' is disabled.`,
    );
  }

  // 2. Security Check (CRITICAL: SSRF protection)
  if (await isBlockedUrl(row.provider.baseUrl)) {
    throw new ProviderNotConfiguredError(
      `Provider '${row.provider.name}' URL is blocked by security policy.`,
    );
  }

  // 3. Transformation
  return buildResolvedProvider(row, userId);
}
