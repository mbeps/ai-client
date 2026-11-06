"use server";

import { chat } from "@/drizzle/schemas/chat-schema";
import { listOwnedResources } from "@/lib/db/utils/list-owned-resources";
import { defineAction } from "@/lib/factories/define-action";
import { ok } from "@/lib/result/ok";
import type { ChatRow } from "@/types/chat/chat-row";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Fetches all chat sessions for the authenticated user, ordered by most recently updated first.
 * Use this to display available chats in the chat list view or navigation.
 * Performs automatic ownership check via session validation.
 * Runs on server only — invoked from client via Server Action.
 *
 * @returns Result containing array of all user's chats sorted by updatedAt descending; empty array if no chats exist.
 * @author Maruf Bepary
 */
export const listChats = defineAction(
  async (): Promise<Result<ChatRow[], CommonError>> => {
    const rows = await listOwnedResources(chat);
    return ok(rows);
  },
);
