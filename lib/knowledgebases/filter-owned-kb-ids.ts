import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { knowledgebase } from "@/drizzle/schemas/knowledgebase-schema";

/**
 * Filters candidate knowledge base IDs to those owned by `userId`.
 * Preserves input order while deduplicating IDs.
 *
 * @param userId - Authenticated owner user ID
 * @param kbIds - Candidate knowledge base IDs
 * @returns Subset of `kbIds` owned by `userId`
 * @author Maruf Bepary
 */
export async function filterOwnedKbIds(
  userId: string,
  kbIds: string[],
): Promise<string[]> {
  const uniqueIds = [...new Set(kbIds.filter(Boolean))];
  if (uniqueIds.length === 0) {
    return [];
  }

  const ownedRows = await db
    .select({ id: knowledgebase.id })
    .from(knowledgebase)
    .where(
      and(
        inArray(knowledgebase.id, uniqueIds),
        eq(knowledgebase.userId, userId),
      ),
    );

  const ownedSet = new Set(ownedRows.map((row) => row.id));
  return uniqueIds.filter((id) => ownedSet.has(id));
}
