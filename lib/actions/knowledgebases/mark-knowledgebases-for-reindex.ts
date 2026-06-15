"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { knowledgebase } from "@/drizzle/schema";
import { requireSession } from "@/lib/actions/require-session";

/**
 * Marks all knowledgebases for the current user as stale and requiring re-index.
 */
export async function markKnowledgebasesForReindex(
  reason = "Embedding model changed",
): Promise<number> {
  const session = await requireSession();

  const updated = await db
    .update(knowledgebase)
    .set({
      needsReindex: "true",
      reindexReason: reason,
      updatedAt: new Date(),
    })
    .where(eq(knowledgebase.userId, session.user.id))
    .returning({ id: knowledgebase.id });

  return updated.length;
}
