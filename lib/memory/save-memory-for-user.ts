import { db } from "@/drizzle/db";
import { userMemory } from "@/drizzle/schemas/user-memory-schema";
import { getLogger } from "@/lib/logger";
import { upsertMemoryPoint } from "@/lib/memory/upsert-memory-point";
import { embedQuery } from "@/lib/rag/embed-query";
import { getUserSettingsByUserId } from "@/lib/user/get-user-settings-by-id";
import type { Memory } from "@/types/memory/memory";

const log = getLogger(["app", "memory", "service"]);

/**
 * Saves a new user memory in PostgreSQL and attempts to index it into Qdrant.
 * If the user's embedding provider is not configured or fails, the memory is still
 * persisted in PostgreSQL and a warning is logged.
 *
 * @param userId - ID of the owning user
 * @param content - Text memory content
 * @returns The persisted Memory object
 * @author Maruf Bepary
 */
export async function saveMemoryForUser(
  userId: string,
  content: string,
): Promise<Memory> {
  const settings = await getUserSettingsByUserId(userId).catch(() => null);
  if (settings && settings.memoryEnabled === false) {
    throw new Error("Memory is disabled for this user");
  }

  const [inserted] = await db
    .insert(userMemory)
    .values({
      userId,
      content,
    })
    .returning();

  try {
    const vector = await embedQuery(content, userId);
    await upsertMemoryPoint(vector.length, {
      id: inserted.id,
      vector,
      userId,
      content,
    });
  } catch (err) {
    log.warn(
      "Failed to index memory into Qdrant (embedding unavailable): {error}",
      {
        error: err instanceof Error ? err.message : String(err),
        userId,
      },
    );
  }

  return {
    id: inserted.id,
    userId: inserted.userId,
    content: inserted.content,
    createdAt: new Date(inserted.createdAt),
    updatedAt: new Date(inserted.updatedAt),
  };
}
