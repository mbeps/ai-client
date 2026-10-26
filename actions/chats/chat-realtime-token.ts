"use server";

import { and, eq } from "drizzle-orm";
import { getClientSubscriptionToken } from "inngest/react";
import { db } from "@/drizzle/db";
import { chat } from "@/drizzle/schemas/chat-schema";
import { requireSession } from "@/lib/auth/require-session";
import { chatChannel } from "@/lib/inngest/chat-channel";
import { inngest } from "@/lib/inngest/client";

/**
 * Server action to mint an authorized subscription token for the chat Inngest Realtime channel.
 * Validates chat ownership before generating the token.
 *
 * @param chatId - UUID of the chat channel to generate a realtime subscription token for
 * @returns Client subscription token string for Inngest Realtime channel subscription
 * @throws {Error} When chat is not found or user lacks ownership
 * @author Maruf Bepary
 */
export async function getChatRealtimeToken(chatId: string) {
  const session = await requireSession();

  const [chatRow] = await db
    .select({ id: chat.id })
    .from(chat)
    .where(and(eq(chat.id, chatId), eq(chat.userId, session.user.id)));

  if (!chatRow) throw new Error("Chat not found or access denied");

  const ch = chatChannel({ chatId });

  return getClientSubscriptionToken(inngest, {
    channel: ch,
    topics: ["stream"],
  });
}
