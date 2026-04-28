"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { chat } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

/**
 * Updates the current leaf pointer for a chat session.
 * Used when navigating between different message branches in the tree.
 *
 * @param chatId - Unique identifier of the chat.
 * @param leafId - Unique identifier of the message that is now the active tip.
 * @returns void (no return value).
 * @throws Error if session is not authenticated (requireSession call fails).
 * @throws Error if chatId or leafId are not valid UUID format.
 * @throws Error if chat does not exist or user does not own it (returns "Not Found").
 * @throws Error if database update fails due to constraints or connection issues.
 * @author Maruf Bepary
 */
export async function updateCurrentLeaf(
  chatId: string,
  leafId: string,
): Promise<void> {
  const session = await requireSession();

  // Validate inputs
  const validatedChatId = z.string().uuid().parse(chatId);
  const validatedLeafId = z.string().uuid().parse(leafId);

  const [updated] = await db
    .update(chat)
    .set({ currentLeafId: validatedLeafId, updatedAt: new Date() })
    .where(
      and(eq(chat.id, validatedChatId), eq(chat.userId, session.user.id)),
    )
    .returning({ id: chat.id });

  if (!updated) throw new Error("Not Found");
}
