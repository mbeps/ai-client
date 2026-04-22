"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { assistant, chat } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";

export async function deleteAssistant(id: string): Promise<void> {
  const session = await requireSession();

  await db.transaction(async (tx) => {
    await tx
      .update(chat)
      .set({ assistantId: null })
      .where(and(eq(chat.assistantId, id), eq(chat.userId, session.user.id)));

    await tx
      .delete(assistant)
      .where(and(eq(assistant.id, id), eq(assistant.userId, session.user.id)));
  });
}
