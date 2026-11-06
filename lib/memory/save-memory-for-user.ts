import { and, eq, sql } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { userMemory } from "@/drizzle/schemas/user-memory-schema";
import { ERROR_CODE } from "@/lib/error/error-code";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import { getUserSettingsByUserId } from "@/lib/user/get-user-settings-by-id";
import type { CommonError } from "@/types/error/common-error";
import type { Memory } from "@/types/memory/memory";
import type { Result } from "@/types/result";

/**
 * Saves a new user memory in PostgreSQL or updates the timestamp if an identical
 * memory already exists for the user (case-insensitive deduplication).
 *
 * @param userId - ID of the owning user
 * @param content - Text memory content
 * @returns Result wrapping the persisted Memory object
 * @author Maruf Bepary
 */
export async function saveMemoryForUser(
  userId: string,
  content: string,
): Promise<Result<Memory, CommonError>> {
  const settings = await getUserSettingsByUserId(userId).catch(() => null);
  if (settings && settings.memoryEnabled === false) {
    return fail({
      code: ERROR_CODE.FORBIDDEN,
      message: "Memory is disabled for this user",
    });
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

    return ok({
      id: existing.id,
      userId: existing.userId,
      content: existing.content,
      createdAt: new Date(existing.createdAt),
      updatedAt: new Date(updated?.updatedAt ?? existing.updatedAt),
      deduplicated: true,
    });
  }

  const [inserted] = await db
    .insert(userMemory)
    .values({
      userId,
      content: trimmed,
    })
    .returning();

  return ok({
    id: inserted.id,
    userId: inserted.userId,
    content: inserted.content,
    createdAt: new Date(inserted.createdAt),
    updatedAt: new Date(inserted.updatedAt),
    deduplicated: false,
  });
}
