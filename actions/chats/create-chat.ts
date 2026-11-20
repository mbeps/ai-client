"use server";

import { db } from "@/drizzle/db";
import { chat } from "@/drizzle/schemas/chat-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { getLogger } from "@/lib/logger";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import { createChatSchema } from "@/schemas/chat/chat";
import type { ChatRow } from "@/types/chat/chat-row";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

const log = getLogger(["app", "actions", "chat"]);

/**
 * Creates a new chat session for the authenticated user.
 * Validates all inputs against createChatSchema and inserts a new chat record with optional project and assistant bindings.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param title - Optional initial title; defaults to "New Chat" if not provided.
 * @param projectId - Optional project ID to scope chat within a specific project context.
 * @param assistantId - Optional assistant ID to bind a persona to the chat.
 * @returns The newly created chat row wrapped in Result.
 */
export const createChat = defineAction(
  async (
    title?: string,
    projectId?: string,
    agentId?: string,
  ): Promise<Result<ChatRow, CommonError>> => {
    const session = await requireSession();

    const parsed = createChatSchema.safeParse({
      title,
      projectId,
      agentId,
    });
    if (!parsed.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: parsed.error.issues[0].message,
        issues: parsed.error.issues.map(
          (i) => `${i.path.join(".")}: ${i.message}`,
        ),
      });
    }

    const validated = parsed.data;

    const [newChat] = await db
      .insert(chat)
      .values({
        id: crypto.randomUUID(),
        title: validated.title ?? "New Chat",
        userId: session.user.id,
        projectId: validated.projectId ?? null,
        agentId: validated.agentId ?? validated.assistantId ?? null,
      })
      .returning();

    log.info("Chat created (id: {chatId})", {
      chatId: newChat.id,
      userId: session.user.id,
      projectId: newChat.projectId,
      agentId: newChat.agentId,
    });

    return ok(newChat);
  },
);
