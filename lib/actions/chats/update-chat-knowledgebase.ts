"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { chat } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";

const updateChatKnowledgebaseSchema = z.object({
  chatId: z.string().min(1),
  knowledgebaseId: z.string().nullable(),
});

export async function updateChatKnowledgebase(
  data: z.infer<typeof updateChatKnowledgebaseSchema>,
): Promise<void> {
  const session = await requireSession();

  const validated = updateChatKnowledgebaseSchema.parse(data);

  const [row] = await db
    .update(chat)
    .set({ knowledgebaseId: validated.knowledgebaseId })
    .where(and(eq(chat.id, validated.chatId), eq(chat.userId, session.user.id)))
    .returning({ id: chat.id });

  if (!row) throw new Error("Not Found");
}
