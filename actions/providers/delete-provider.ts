"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiProvider } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";

/**
 * Deletes an AI provider configuration and all associated models for the authenticated user.
 * Enforces ownership check before deletion.
 * Associated aiModel rows are cascade-deleted via foreign key constraint.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param providerId - UUID of the provider to delete; must be owned by the authenticated user.
 * @returns void (no return value).
 * @throws Error if session is not authenticated.
 * @throws Error if provider is not found or user does not own it (returns "Not Found").
 * @throws Error if database deletion fails due to constraints or connection issues.
 * @see createProvider to add a new provider.
 * @see listProviders to view all providers.
 * @author Maruf Bepary
 */
export async function deleteProvider(providerId: string): Promise<void> {
  const session = await requireSession();

  const [deleted] = await db
    .delete(aiProvider)
    .where(
      and(
        eq(aiProvider.id, providerId),
        eq(aiProvider.userId, session.user.id),
      ),
    )
    .returning({ id: aiProvider.id });

  if (!deleted) {
    throw new Error("Not Found");
  }
}
