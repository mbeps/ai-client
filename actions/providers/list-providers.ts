"use server";

import { asc, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiProvider } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";
import type { AiProviderRow } from "@/types/provider/ai-provider-row";

/**
 * Fetches all AI provider configurations for the authenticated user.
 * Returns providers sorted alphabetically by name.
 * Sensitive fields (encrypted API keys, headers) are returned encrypted — use decodeProviderRecord to decrypt.
 * Runs on server only — invoked from client via Server Action.
 *
 * @returns Array of provider records sorted by name; empty array if no providers configured.
 * @throws Error if session is not authenticated.
 * @throws Error if database query fails due to connection issues.
 * @see createProvider to add a new provider.
 * @see updateProvider to modify provider settings.
 * @author Maruf Bepary
 */
export async function listProviders(): Promise<AiProviderRow[]> {
  const session = await requireSession();

  return db
    .select()
    .from(aiProvider)
    .where(eq(aiProvider.userId, session.user.id))
    .orderBy(asc(aiProvider.name));
}
