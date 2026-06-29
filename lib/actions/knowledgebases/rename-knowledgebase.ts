"use server";

import { knowledgebase } from "@/drizzle/schema";
import { renameKnowledgebaseSchema } from "@/schemas/knowledgebase/knowledgebase";
import { renameEntityFactory } from "@/lib/actions/shared/rename-entity-factory";
import type { KnowledgebaseRow } from "@/types/knowledgebase/knowledgebase-row";

/**
 * Renames a knowledge base with ownership check.
 * Uses renameEntityFactory to handle validation and database operations.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param knowledgebaseId - UUID of the knowledge base to rename; must be owned by the authenticated user.
 * @param name - New display name for the knowledge base; must pass renameKnowledgebaseSchema validation.
 * @returns The updated knowledge base record with new name.
 * @throws Error if session is not authenticated.
 * @throws ZodError if knowledgebaseId is not a valid UUID format.
 * @throws ZodError if name fails schema validation.
 * @throws Error if knowledge base is not found or user does not own it (returns "Not Found").
 * @throws Error if database update fails due to constraints or connection issues.
 * @deprecated Use @see updateKnowledgebase instead for consolidated metadata updates.
 * @see createKnowledgebase to create a new knowledge base.
 * @see deleteKnowledgebase to remove a knowledge base.
 * @author Maruf Bepary
 */
export const renameKnowledgebase = renameEntityFactory<KnowledgebaseRow>({
  table: knowledgebase,
  nameSchema: renameKnowledgebaseSchema.shape.name,
  validateId: false,
});
