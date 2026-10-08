"use server";

import { desc, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { userMemory } from "@/drizzle/schemas/user-memory-schema";
import { requireSession } from "@/lib/auth/require-session";
import type { Memory } from "@/types/memory/memory";

/**
 * Fetches all saved memories for the authenticated user, ordered by most recently updated.
 *
 * @returns Array of Memory objects
 * @author Maruf Bepary
 */
export async function listMemories(): Promise<Memory[]> {
  const session = await requireSession();

  const rows = await db
    .select()
    .from(userMemory)
    .where(eq(userMemory.userId, session.user.id))
    .orderBy(desc(userMemory.updatedAt));

  return rows.map((row) => ({
    id: row.id,
    userId: row.userId,
    content: row.content,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  }));
}
