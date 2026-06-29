"use server";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { aiModel } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";
import { logger } from "@/lib/logger";

/**
 * Deletes one or more AI models belonging to the authenticated user.
 * Accepts a single modelId string or array of modelIds for batch deletion.
 * Logs deletion events for audit purposes.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param modelIdOrIds - UUID of a single model or array of UUIDs to delete; all must be owned by the authenticated user.
 * @returns void (no return value).
 * @throws Error if session is not authenticated.
 * @throws Error if modelIds array is empty (no-op, returns early without throwing).
 * @throws Error if no matching models found for the given IDs (returns "Not Found").
 * @throws Error if database deletion fails due to constraints or connection issues.
 * @see createModel to register a new model.
 * @see listModels to fetch all models.
 * @author Maruf Bepary
 */
export async function deleteModel(
  modelIdOrIds: string | string[],
): Promise<void> {
  const session = await requireSession();
  const ids = Array.isArray(modelIdOrIds) ? modelIdOrIds : [modelIdOrIds];

  if (ids.length === 0) return;

  const deleted = await db
    .delete(aiModel)
    .where(and(inArray(aiModel.id, ids), eq(aiModel.userId, session.user.id)))
    .returning({ id: aiModel.id });

  logger.info(
    "Models deleted successfully",
    { count: deleted.length, ids, userId: session.user.id },
    session.user.id,
  );

  if (deleted.length === 0) {
    throw new Error("Not Found");
  }
}
