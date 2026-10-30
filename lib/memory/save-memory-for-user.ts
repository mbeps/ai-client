import { and, eq, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { userMemory } from "@/drizzle/schemas/user-memory-schema";
import { getUserSettingsByUserId } from "@/lib/user/get-user-settings-by-id";
import type { Memory } from "@/types/memory/memory";

/**
 * Saves a new user memory in PostgreSQL or updates the timestamp if an identical
 * memory already exists for the user (case-insensitive deduplication).
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

  const trimmed = content.trim();

  // Deduplicate exact/case-insensitive content for the user
  const [existing] = await db
    .select()
    .from(userMemory)
    .where(
      and(
        eq(userMemory.userId, userId),
        sql`lower(${userMemory.content}) = lower(${trimmed})`,
      ),
    )
    .limit(1);

  if (existing) {
    const [updated] = await db
      .update(userMemory)
      .set({ updatedAt: new Date() })
      .where(eq(userMemory.id, existing.id))
      .returning();

    return {
      id: existing.id,
      userId: existing.userId,
      content: existing.content,
      createdAt: new Date(existing.createdAt),
      updatedAt: new Date(updated?.updatedAt ?? existing.updatedAt),
      deduplicated: true,
    };
  }

  const [inserted] = await db
    .insert(userMemory)
    .values({
      userId,
      content: trimmed,
    })
    .returning();

  return {
    id: inserted.id,
    userId: inserted.userId,
    content: inserted.content,
    createdAt: new Date(inserted.createdAt),
    updatedAt: new Date(inserted.updatedAt),
    deduplicated: false,
  };
}
