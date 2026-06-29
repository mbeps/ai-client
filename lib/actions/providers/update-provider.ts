"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiProvider } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";
import {
  updateProviderSchema,
  type UpdateProviderInput,
} from "@/schemas/providers/provider-registry";
import type { AiProviderRow } from "@/types/provider/ai-provider-row";
import { toEncryptedProviderValues } from "./utils";

/**
 * Updates an existing AI provider configuration with partial field updates.
 * Re-encrypts sensitive fields (API key, headers) if provided.
 * If API key or headers are not included in update, existing encrypted values are preserved.
 * Enforces ownership check before modifying provider.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param providerId - UUID of the provider to update; must be owned by the authenticated user.
 * @param input - Partial provider update object (name, baseUrl, apiKey, headers, isEnabled, requiresKey).
 * @returns The updated provider record with encrypted credentials.
 * @throws Error if session is not authenticated.
 * @throws ZodError if data fails schema validation against updateProviderSchema.
 * @throws Error if provider is not found or user does not own it (returns "Not Found").
 * @throws Error if database update fails due to constraints or connection issues.
 * @see createProvider to add a new provider.
 * @see testProviderConnection to verify provider connectivity after update.
 * @author Maruf Bepary
 */
export async function updateProvider(
  providerId: string,
  input: UpdateProviderInput,
): Promise<AiProviderRow> {
  const session = await requireSession();
  const parsed = updateProviderSchema.parse(input);

  const [existing] = await db
    .select()
    .from(aiProvider)
    .where(
      and(
        eq(aiProvider.id, providerId),
        eq(aiProvider.userId, session.user.id),
      ),
    );

  if (!existing) {
    throw new Error("Not Found");
  }

  const encrypted =
    Object.prototype.hasOwnProperty.call(parsed, "apiKey") ||
    Object.prototype.hasOwnProperty.call(parsed, "headers")
      ? toEncryptedProviderValues({
          apiKey: parsed.apiKey,
          headers: parsed.headers,
        })
      : null;

  const [updated] = await db
    .update(aiProvider)
    .set({
      ...(parsed.name !== undefined ? { name: parsed.name } : {}),
      ...(parsed.baseUrl !== undefined ? { baseUrl: parsed.baseUrl } : {}),
      ...(parsed.isEnabled !== undefined
        ? { isEnabled: parsed.isEnabled }
        : {}),
      ...(parsed.requiresKey !== undefined
        ? { requiresKey: parsed.requiresKey }
        : {}),
      ...(encrypted
        ? {
            apiKey:
              encrypted.apiKey === null ? existing.apiKey : encrypted.apiKey,
            headers:
              encrypted.headers === null ? existing.headers : encrypted.headers,
          }
        : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(aiProvider.id, providerId),
        eq(aiProvider.userId, session.user.id),
      ),
    )
    .returning();

  if (!updated) {
    throw new Error("Not Found");
  }

  return updated;
}
