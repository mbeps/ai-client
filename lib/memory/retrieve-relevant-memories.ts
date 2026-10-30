import { desc, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { userMemory } from "@/drizzle/schemas/user-memory-schema";
import { getUserSettingsByUserId } from "@/lib/user/get-user-settings-by-id";

/**
 * Retrieves relevant memories for a user during chat context loading.
 * Queries PostgreSQL directly ordered by most recent update.
 *
 * @param userId - ID of the user
 * @param _query - Optional search query (unused in recency-based retrieval)
 * @param limit - Maximum memories to return (default: 20)
 * @returns Array of memory content strings
 * @author Maruf Bepary
 */
export async function retrieveRelevantMemories(
  userId: string,
  _query?: string,
  limit = 20,
): Promise<string[]> {
  const settings = await getUserSettingsByUserId(userId).catch(() => null);
  if (settings && settings.memoryEnabled === false) {
    return [];
  }

  const rows = await db
    .select({ content: userMemory.content })
    .from(userMemory)
    .where(eq(userMemory.userId, userId))
    .orderBy(desc(userMemory.updatedAt))
    .limit(limit);

  return rows.map((r) => r.content);
}
