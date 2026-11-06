"use server";

import { desc, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { userMemory } from "@/drizzle/schemas/user-memory-schema";
import { requireSession } from "@/lib/auth/require-session";
import { defineAction } from "@/lib/factories/define-action";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Memory } from "@/types/memory/memory";
import type { Result } from "@/types/result";

/**
 * Fetches all saved memories for the authenticated user, ordered by most recently updated.
 *
 * @returns Result wrapping array of Memory objects
 * @author Maruf Bepary
 */
export const listMemories = defineAction(
  async (): Promise<Result<Memory[], CommonError>> => {
    const session = await requireSession();

    const rows = await db
      .select()
      .from(userMemory)
      .where(eq(userMemory.userId, session.user.id))
      .orderBy(desc(userMemory.updatedAt));

    return ok(
      rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        content: row.content,
        createdAt: new Date(row.createdAt),
        updatedAt: new Date(row.updatedAt),
      })),
    );
  },
);
