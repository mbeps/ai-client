import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { userMemory } from "@/drizzle/schemas/user-memory-schema";
import { getLogger } from "@/lib/logger";
import { deleteMemoryPoints } from "@/lib/memory/delete-memory-points";

const log = getLogger(["app", "memory", "service"]);

/**
 * Deletes user memories from PostgreSQL and removes their points from Qdrant.
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

  try {
    await deleteMemoryPoints(ids);
  } catch (err) {
    log.warn("Failed to delete memory points from Qdrant: {error}", {
      error: err instanceof Error ? err.message : String(err),
      userId,
      ids,
    });
  }
}
