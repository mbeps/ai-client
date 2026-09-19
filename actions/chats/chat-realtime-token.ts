"use server";

import { and, eq } from "drizzle-orm";
import { getClientSubscriptionToken } from "inngest/react";
import { db } from "@/drizzle/db";
import { chat } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";
import { chatChannel } from "@/lib/inngest/channels";
import { inngest } from "@/lib/inngest/client";

interface TriggerChatResponseData {
  chatId: string;
  userMessageId: string;
  model?: string;
  selectedServerIds?: string[];
  selectedTools?: string[];
  selectedAssistantId?: string;
  selectedSkillIds?: string[];
  selectedKbIds?: string[];
}

/**
 * Server action to mint an authorized subscription token for the chat Inngest Realtime channel.
 * Validates chat ownership before generating the token.
 *
 * @author Maruf Bepary
 */
export async function getChatRealtimeToken(chatId: string) {
  const session = await requireSession();

  const [chatRow] = await db
    .select({ id: chat.id })
    .from(chat)
    .where(and(eq(chat.id, chatId), eq(chat.userId, session.user.id)));

  if (!chatRow) throw new Error("Unauthorized");

  const ch = chatChannel({ chatId });

  return getClientSubscriptionToken(inngest, {
    channel: ch,
    topics: ["stream"],
  });
}

/**
 * Server action to trigger an AI chat response generation as an Inngest background job.
 * Validates chat ownership and dispatches the event.
 *
 * @author Maruf Bepary
 */
export async function triggerChatResponseAction(data: TriggerChatResponseData) {
  const session = await requireSession();

  const [chatRow] = await db
    .select({ id: chat.id })
    .from(chat)
    .where(and(eq(chat.id, data.chatId), eq(chat.userId, session.user.id)));

  if (!chatRow) throw new Error("Chat not found or access denied");

  await inngest.send({
    name: "chat/response.generate",
    data: {
      chatId: data.chatId,
      userId: session.user.id,
      userMessageId: data.userMessageId,
      model: data.model,
      selectedServerIds: data.selectedServerIds,
      selectedTools: data.selectedTools,
      selectedAssistantId: data.selectedAssistantId,
      selectedSkillIds: data.selectedSkillIds,
      selectedKbIds: data.selectedKbIds,
    },
  });

  return { success: true };
}
