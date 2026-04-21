"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { chat } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";

export async function updateCurrentLeaf(
  chatId: string,
  leafId: string,
): Promise<void> {
  const session = await requireSession();

  const [updated] = await db
    .update(chat)
    .set({ currentLeafId: leafId, updatedAt: new Date() })
    .where(and(eq(chat.id, chatId), eq(chat.userId, session.user.id)))
    .returning({ id: chat.id });

  if (!updated) throw new Error("Not Found");
}
