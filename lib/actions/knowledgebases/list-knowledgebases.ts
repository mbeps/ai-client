"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { knowledgebase } from "@/drizzle/schema";
import { eq, desc, sql } from "drizzle-orm";
import type { KnowledgebaseRow } from "@/types/knowledgebase/knowledgebase-row";

/**
 * KB record with denormalized documentCount computed via SQL subquery (no N+1).
 *
 * @typedef {Object} KnowledgebaseWithCount
 * @property {KnowledgebaseRow} - All base KB fields
 * @property {number} documentCount - Total documents in KB
 */
export type KnowledgebaseWithCount = KnowledgebaseRow & {
  documentCount: number;
};

/**
 * Lists user KBs with document counts (newest first). Uses SQL subquery to avoid N+1.
 *
 * @async
 * @returns KBs with counts ordered by updatedAt DESC
 * @throws If session authentication fails
 * @author Maruf Bepary
 */
export async function listKnowledgebases(): Promise<KnowledgebaseWithCount[]> {
  const session = await requireSession();

  return db
    .select({
      id: knowledgebase.id,
      userId: knowledgebase.userId,
      name: knowledgebase.name,
      description: knowledgebase.description,
      indexStatus: knowledgebase.indexStatus,
      lastIndexedAt: knowledgebase.lastIndexedAt,
      createdAt: knowledgebase.createdAt,
      updatedAt: knowledgebase.updatedAt,
      documentCount: sql<number>`(
        SELECT COUNT(*)::int FROM kb_document WHERE kb_document.kb_id = ${knowledgebase.id}
      )`.mapWith(Number),
    })
    .from(knowledgebase)
    .where(eq(knowledgebase.userId, session.user.id))
    .orderBy(desc(knowledgebase.updatedAt));
}
