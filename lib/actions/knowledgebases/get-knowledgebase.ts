"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { knowledgebase } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import type { KnowledgebaseRow } from "@/types/knowledgebase/knowledgebase-row";

/**
 * Fetches a single knowledge base with its metadata and index status for the authenticated user.
 * Validates knowledge base ownership before returning data.
 * Use this to retrieve current indexing status or knowledge base details.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param kbId - UUID of the knowledge base to retrieve; must be owned by the authenticated user.
 * @returns The knowledge base record with name, description, and index status.
 * @throws Error if session is not authenticated.
 * @throws Error if knowledge base is not found or user does not own it (returns "Not Found").
 * @throws Error if database query fails due to connection issues.
 * @see listKnowledgebases to fetch all knowledge bases.
 * @see listDocuments to fetch documents in this knowledge base.
 * @author Maruf Bepary
 */
export async function getKnowledgebase(
  id: string,
): Promise<KnowledgebaseRow | undefined> {
  const session = await requireSession();

  const [row] = await db
    .select({
      id: knowledgebase.id,
      userId: knowledgebase.userId,
      name: knowledgebase.name,
      description: knowledgebase.description,
      indexStatus: knowledgebase.indexStatus,
      lastIndexedAt: knowledgebase.lastIndexedAt,
      createdAt: knowledgebase.createdAt,
      updatedAt: knowledgebase.updatedAt,
    })
    .from(knowledgebase)
    .where(
      and(eq(knowledgebase.id, id), eq(knowledgebase.userId, session.user.id)),
    )
    .limit(1);

  return row;
}
