"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { knowledgebase } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { KnowledgebaseRow } from "@/types/knowledgebase-row";
import { renameKnowledgebaseSchema } from "@/schemas/knowledgebase";

/**
 * Renames a knowledgebase.
 * @deprecated Use updateKnowledgebase instead for consolidated metadata updates.
 *
 * @param kbId - The unique ID of the knowledgebase to rename.
 * @param name - The new name for the knowledgebase.
 * @returns The updated knowledgebase record.
 */
export async function renameKnowledgebase(
  kbId: string,
  name: string,
): Promise<KnowledgebaseRow> {
  const session = await requireSession();

  const validated = renameKnowledgebaseSchema.parse({ name });

  const [row] = await db
    .update(knowledgebase)
    .set({ name: validated.name, updatedAt: new Date() })
    .where(
      and(
        eq(knowledgebase.id, kbId),
        eq(knowledgebase.userId, session.user.id),
      ),
    )
    .returning();

  if (!row) throw new Error("Not Found");

  return row;
}
