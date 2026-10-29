import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { userMemory } from "@/drizzle/schemas/user-memory-schema";
import type { Memory } from "@/types/memory/memory";

/**
 * Updates an existing memory in PostgreSQL.
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
      updatedAt: new Date(),
    })
    .where(and(eq(userMemory.id, id), eq(userMemory.userId, userId)))
    .returning();

  if (!updated) {
    throw new Error("Memory not found");
  }

  return {
    id: updated.id,
    userId: updated.userId,
    content: updated.content,
    createdAt: new Date(updated.createdAt),
    updatedAt: new Date(updated.updatedAt),
  };
}
