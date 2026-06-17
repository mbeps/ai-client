"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { knowledgebase } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import type { KnowledgebaseRow } from "@/types/knowledgebase-row";

/**
 * Fetches a single knowledge base by ID, ensuring it belongs to the authenticated user.
 *
 * @param id - The UUID of the knowledge base to fetch.
 * @returns The knowledge base row if found and owned by the user.
 * @throws Error if unauthorized or not found.
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
