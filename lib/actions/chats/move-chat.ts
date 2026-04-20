"use server";

import { auth } from "@/lib/auth/auth";
import { db } from "@/drizzle/db";
import { chat } from "@/drizzle/schema";
import { eq, and } from "drizzle-orm";
import { headers } from "next/headers";
import type { ChatRow } from "./types";

/**
 * Moves a chat to a specific project or removes it from all projects.
 *
 * @param chatId - Unique identifier of the chat.
 * @param projectId - ID of the target project, or null to dissociate from all projects.
 * @returns The updated chat record.
 * @author Maruf Bepary
 */
export async function moveChat(chatId: string, projectId: string | null): Promise<ChatRow> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const [updatedChat] = await db
    .update(chat)
    .set({ projectId, updatedAt: new Date() })
    .where(and(eq(chat.id, chatId), eq(chat.userId, session.user.id)))
    .returning();

  if (!updatedChat) throw new Error("Chat not found or access denied");

  return updatedChat;
}
