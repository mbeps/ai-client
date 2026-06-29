"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { knowledgebase } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { KnowledgebaseRow } from "@/types/knowledgebase/knowledgebase-row";
import { updateKnowledgebaseSchema } from "@/schemas/knowledgebase/knowledgebase";
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
export async function updateKnowledgebase(
  id: string,
  data: z.infer<typeof updateKnowledgebaseSchema>,
): Promise<KnowledgebaseRow> {
  const session = await requireSession();

  // Validate inputs
  const validatedId = z.string().uuid().parse(id);
  const validatedData = updateKnowledgebaseSchema.parse(data);

  const updateData: Record<string, any> = {
    updatedAt: new Date(),
  };

  if (validatedData.name !== undefined) updateData.name = validatedData.name;
  if (validatedData.description !== undefined)
    updateData.description = validatedData.description ?? null;

  const [row] = await db
    .update(knowledgebase)
    .set(updateData)
    .where(
      and(
        eq(knowledgebase.id, validatedId),
        eq(knowledgebase.userId, session.user.id),
      ),
    )
    .returning();

  if (!row) {
    throw new Error("Not Found");
  }

  return row as KnowledgebaseRow;
}
