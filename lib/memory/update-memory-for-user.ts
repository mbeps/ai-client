import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { userMemory } from "@/drizzle/schemas/user-memory-schema";
import { getLogger } from "@/lib/logger";
import { upsertMemoryPoint } from "@/lib/memory/upsert-memory-point";
import { embedQuery } from "@/lib/rag/embed-query";
import type { Memory } from "@/types/memory/memory";

const log = getLogger(["app", "memory", "service"]);

/**
 * Updates an existing memory in PostgreSQL and re-indexes it into Qdrant.
 *
 * @param userId - ID of the owning user
 * @param id - Memory UUID
 * @param content - New memory content
 * @returns The updated Memory object
 * @throws Error if the memory does not exist or does not belong to the user
 * @author Maruf Bepary
 */
export async function updateMemoryForUser(
  userId: string,
  id: string,
  content: string,
): Promise<Memory> {
  const [updated] = await db
    .update(userMemory)
    .set({
      content,
    })
    .where(and(eq(userMemory.id, id), eq(userMemory.userId, userId)))
    .returning();

  if (!updated) {
    throw new Error("Memory not found");
  }

  try {
    const vector = await embedQuery(content, userId);
    await upsertMemoryPoint(vector.length, {
      id: updated.id,
      vector,
      userId,
      content,
    });
  } catch (err) {
    log.warn(
      "Failed to re-index memory in Qdrant (embedding unavailable): {error}",
      {
        error: err instanceof Error ? err.message : String(err),
        userId,
      },
    );
  }

  return {
    id: updated.id,
    userId: updated.userId,
    content: updated.content,
    createdAt: new Date(updated.createdAt),
    updatedAt: new Date(updated.updatedAt),
  };
}
