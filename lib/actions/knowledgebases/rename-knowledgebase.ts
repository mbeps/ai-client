"use server";

import { knowledgebase } from "@/drizzle/schema";
import { renameKnowledgebaseSchema } from "@/schemas/knowledgebase/knowledgebase";
import { renameEntityFactory } from "@/lib/actions/shared/rename-entity-factory";
import type { KnowledgebaseRow } from "@/types/knowledgebase/knowledgebase-row";

/**
 * Renames a knowledgebase.
 * @deprecated Use updateKnowledgebase instead for consolidated metadata updates.
 *
 * @param kbId - The unique ID of the knowledgebase to rename.
 * @param name - The new name for the knowledgebase.
 * @returns The updated knowledgebase record.
 */
export const renameKnowledgebase = renameEntityFactory<KnowledgebaseRow>({
  table: knowledgebase,
  nameSchema: renameKnowledgebaseSchema.shape.name,
  validateId: false,
});
