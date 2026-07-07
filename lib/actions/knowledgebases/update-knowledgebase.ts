"use server";

import { knowledgebase } from "@/drizzle/schema";
import type { KnowledgebaseRow } from "@/types/knowledgebase/knowledgebase-row";
import { updateKnowledgebaseSchema } from "@/schemas/knowledgebase/knowledgebase";
import { updateEntityFactory } from "@/lib/actions/shared/update-entity-factory";
import { z } from "zod";

/**
 * Updates an existing knowledge base with partial field updates (name, description, indexStatus).
 * Validates all inputs and enforces ownership check before updating database record.
 * Allows manual status changes to trigger reindexing or mark index as stale.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param id - UUID of the knowledge base to update; must be owned by the authenticated user.
 * @param data - Partial knowledge base update object (name, description, indexStatus fields).
 * @returns The updated knowledge base record with all fields populated.
 * @throws Error if session is not authenticated.
 * @throws ZodError if id is not a valid UUID format.
 * @throws ZodError if data fails schema validation against updateKnowledgebaseSchema.
 * @throws Error if knowledge base is not found or user does not own it (returns "Not Found").
 * @throws Error if database update fails due to constraints or connection issues.
 * @see createKnowledgebase to create a new knowledge base.
 * @see reindexKnowledgebase to trigger re-indexing.
 * @author Maruf Bepary
 */
export const updateKnowledgebase = updateEntityFactory<
  z.infer<typeof updateKnowledgebaseSchema>,
  KnowledgebaseRow
>({
  table: knowledgebase,
  schema: updateKnowledgebaseSchema,
  mapValues: (data) => {
    const values: Record<string, any> = {};
    if (data.name !== undefined) values.name = data.name;
    if (data.description !== undefined)
      values.description = data.description ?? null;
    return values;
  },
});
