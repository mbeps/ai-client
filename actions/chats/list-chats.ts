"use server";

import { and, desc, eq, isNull } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { chat } from "@/drizzle/schemas/chat-schema";
import { requireSession } from "@/lib/auth/require-session";
import { defineAction } from "@/lib/factories/define-action";
import { ok } from "@/lib/result/ok";
import type { ChatRow } from "@/types/chat/chat-row";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Options for listing user chats.
 */
export interface ListChatsOptions {
  /** Whether to include workflow-scoped builder chats (`workflowId IS NOT NULL`). Defaults to `false`. */
  includeWorkflowChats?: boolean;
}

/**
 * Fetches chat sessions for the authenticated user, ordered by most recently updated first.
 * Excludes workflow-scoped builder chats (`workflowId IS NOT NULL`) by default so they do not appear in the main sidebar.
 *
 * @param options - Optional filtering configuration.
 * @returns Result containing array of user's chats sorted by updatedAt descending.
 * @author Maruf Bepary
 */
export const listChats = defineAction(
  async (
    options?: ListChatsOptions,
  ): Promise<Result<ChatRow[], CommonError>> => {
    const session = await requireSession();
    const whereClause = options?.includeWorkflowChats
      ? eq(chat.userId, session.user.id)
      : and(eq(chat.userId, session.user.id), isNull(chat.workflowId));

    const rows = await db
      .select()
      .from(chat)
      .where(whereClause)
      .orderBy(desc(chat.updatedAt));
    return ok(rows);
  },
);
