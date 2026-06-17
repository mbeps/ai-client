"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { knowledgebase } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { KnowledgebaseRow } from "@/types/knowledgebase/knowledgebase-row";
import { updateKnowledgebaseSchema } from "@/schemas/knowledgebase";
import { z } from "zod";

/**
 * Updates an existing knowledgebase's metadata (name and description).
 * Replaces renameKnowledgebase as the primary update mechanism for KB settings.
 *
 * @param id - The unique ID of the knowledgebase to update.
 * @param data - The fields to update (name, description).
 * @returns The updated knowledgebase record.
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
    throw new Error("Knowledge base not found or unauthorized");
  }

  return row as KnowledgebaseRow;
}
