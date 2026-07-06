"use server";

import { aiModel } from "@/drizzle/schema";
import { logger } from "@/lib/logger";
import { deleteEntityFactory } from "@/lib/actions/shared/delete-entity-factory";

/**
 * Deletes one or more AI models belonging to the authenticated user.
 * Accepts a single modelId string or array of modelIds for batch deletion.
 * Logs deletion events for audit purposes.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param modelIdOrIds - UUID of a single model or array of UUIDs to delete; all must be owned by the authenticated user.
 * @returns { deletedCount: number } - The number of models successfully deleted.
 * @throws Error if session is not authenticated.
 * @throws Error if modelIds array is empty (no-op, returns early without throwing).
 * @throws Error if no matching models found for the given IDs (returns "Not Found").
 * @throws Error if database deletion fails due to constraints or connection issues.
 * @see createModel to register a new model.
 * @see listModels to fetch all models.
 * @author Maruf Bepary
 */
export const deleteModel = deleteEntityFactory({
  table: aiModel,
  onDelete: async (userId, ids) => {
    logger.info(
      "Models deleted successfully",
      { count: ids.length, ids, userId },
      userId,
    );
  },
});
