"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { chat, knowledgebase } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { updateChatKnowledgebaseSchema } from "@/schemas/chat/chat";

/**
 * Updates chat knowledge base after validating ownership. Pass null to disable RAG context.
 *
 * @async
 * @param data - {chatId, knowledgebaseId} payload
 * @throws "Not Found" if chat or knowledgebase not owned by current user
 * @author Maruf Bepary
 */
export async function updateChatKnowledgebase(
  data: z.infer<typeof updateChatKnowledgebaseSchema>,
): Promise<void> {
  const session = await requireSession();

  const validated = updateChatKnowledgebaseSchema.parse(data);

  if (validated.knowledgebaseId) {
    const [kb] = await db
      .select({ id: knowledgebase.id })
      .from(knowledgebase)
      .where(
        and(
          eq(knowledgebase.id, validated.knowledgebaseId),
          eq(knowledgebase.userId, session.user.id),
        ),
      );

    if (!kb) {
      throw new Error("Not Found");
    }
  }

  const [row] = await db
    .update(chat)
    .set({ knowledgebaseId: validated.knowledgebaseId })
    .where(and(eq(chat.id, validated.chatId), eq(chat.userId, session.user.id)))
    .returning({ id: chat.id });

  if (!row) throw new Error("Not Found");
}
