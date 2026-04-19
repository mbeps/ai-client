"use server";

import { auth } from "@/lib/auth/auth";
import { db } from "@/drizzle/db";
import { chat } from "@/drizzle/schema";
import { headers } from "next/headers";
import { v4 as uuidv4 } from "uuid";
import type { ChatRow } from "./types";

export async function createChat(
  title?: string,
  projectId?: string,
  assistantId?: string,
): Promise<ChatRow> {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  const [newChat] = await db
    .insert(chat)
    .values({
      id: uuidv4(),
      title: title ?? "New Chat",
      userId: session.user.id,
      projectId: projectId ?? null,
      assistantId: assistantId ?? null,
    })
    .returning();

  return newChat;
}
