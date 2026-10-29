import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { userMemory } from "@/drizzle/schemas/user-memory-schema";

/**
 * Deletes user memories from PostgreSQL.
 *
 * @param userId - ID of the owning user
 * @param ids - Array of memory UUIDs
 * @author Maruf Bepary
 */
export async function deleteMemoriesForUser(
  userId: string,
  ids: string[],
): Promise<void> {
  if (ids.length === 0) return;

  await db
    .delete(userMemory)
    .where(and(eq(userMemory.userId, userId), inArray(userMemory.id, ids)));
}
