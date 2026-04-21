"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { assistant } from "@/drizzle/schema";
import type { AssistantRow } from "./types";

export async function createAssistant(data: {
  name: string;
  description?: string;
  prompt?: string;
  avatar?: string;
}): Promise<AssistantRow> {
  const session = await requireSession();

  const [row] = await db
    .insert(assistant)
    .values({
      name: data.name,
      description: data.description ?? null,
      prompt: data.prompt ?? null,
      avatar: data.avatar ?? null,
      userId: session.user.id,
    })
    .returning();

  return row;
}
