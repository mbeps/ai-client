import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { userMemory } from "@/drizzle/schemas/user-memory-schema";
import { ERROR_CODE } from "@/lib/error/error-code";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Memory } from "@/types/memory/memory";
import type { Result } from "@/types/result";

/**
 * Updates an existing memory in PostgreSQL.
 *
 * @param userId - ID of the owning user
 * @param id - Memory UUID
 * @param content - New memory content
 * @returns Result wrapping the updated Memory object
 * @author Maruf Bepary
 */
export async function updateMemoryForUser(
  userId: string,
  id: string,
  content: string,
): Promise<Result<Memory, CommonError>> {
  const [updated] = await db
    .update(userMemory)
    .set({
      content,
      updatedAt: new Date(),
    })
    .where(and(eq(userMemory.id, id), eq(userMemory.userId, userId)))
    .returning();

  if (!updated) {
    return fail({
      code: ERROR_CODE.NOT_FOUND,
      message: "Memory not found",
    });
  }

  return ok({
    id: updated.id,
    userId: updated.userId,
    content: updated.content,
    createdAt: new Date(updated.createdAt),
    updatedAt: new Date(updated.updatedAt),
  });
}
