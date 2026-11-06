"use server";

import { and, eq } from "drizzle-orm";
import { getClientSubscriptionToken } from "inngest/react";
import { db } from "@/drizzle/db";
import { chat } from "@/drizzle/schemas/chat-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { chatChannel } from "@/lib/inngest/chat-channel";
import { inngest } from "@/lib/inngest/client";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

type ChatRealtimeToken = Awaited<ReturnType<typeof getClientSubscriptionToken>>;

/**
 * Server action to mint an authorized subscription token for the chat Inngest Realtime channel.
 * Validates chat ownership before generating the token.
 *
 * @param chatId - UUID of the chat channel to generate a realtime subscription token for
 * @returns Client subscription token string wrapped in Result
 * @author Maruf Bepary
 */
export const getChatRealtimeToken = defineAction(
  async (chatId: string): Promise<Result<ChatRealtimeToken, CommonError>> => {
    const session = await requireSession();

    const [chatRow] = await db
      .select({ id: chat.id })
      .from(chat)
      .where(and(eq(chat.id, chatId), eq(chat.userId, session.user.id)));

    if (!chatRow) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Chat not found or access denied",
      });
    }

    const ch = chatChannel({ chatId });

    const token = await getClientSubscriptionToken(inngest, {
      channel: ch,
      topics: ["stream"],
    });

    return ok(token);
  },
);
