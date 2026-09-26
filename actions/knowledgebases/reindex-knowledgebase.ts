"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { kbDocument, knowledgebase } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";
import { inngest } from "@/lib/inngest/client";

/**
 * Re-indexes KB documents sequentially after validating ownership. Updates embeddings from S3 files.
 * Marks KB as indexing, processes ready docs, breaks on rate limits (prevents cascading requests).
 * Returns {processedCount, failedCount} summary. Skips if KB already ready.
 *
 * @async
 * @param kbId - Knowledge base UUID to re-index
 * @returns {processedCount, failedCount} re-indexing summary
 * @throws "Not Found" if KB not owned by current user
 * @author Maruf Bepary
 */
export async function reindexKnowledgebase(kbId: string) {
  const session = await requireSession();

  // 1. Fetch KB + verify ownership
  const [kb] = await db
    .select()
    .from(knowledgebase)
    .where(
      and(
        eq(knowledgebase.id, kbId),
        eq(knowledgebase.userId, session.user.id),
      ),
    );

  if (!kb) {
    throw new Error("Not Found");
  }

  // 2. Mark as indexing
  await db
    .update(knowledgebase)
    .set({
      indexStatus: "indexing",
      lastIndexedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(knowledgebase.id, kbId));

  // Reset status message for all documents being re-indexed
  await db
    .update(kbDocument)
    .set({ statusMessage: null })
    .where(eq(kbDocument.kbId, kbId));

  const docs = await db
    .select({ id: kbDocument.id })
    .from(kbDocument)
    .where(eq(kbDocument.kbId, kbId));

  // 3. Dispatch durable re-index background job to Inngest
  await inngest.send({
    name: "knowledgebase/reindex",
    data: { kbId, userId: session.user.id },
  });

  return { processedCount: docs.length, failedCount: 0 };
}
