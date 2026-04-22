"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { prompt } from "@/drizzle/schema";
import type { PromptRow } from "@/types/prompt-row";

export async function createPrompt(data: {
  title: string;
  shortcut: string;
  content: string;
}): Promise<PromptRow> {
  const session = await requireSession();

  const [row] = await db
    .insert(prompt)
    .values({
      ...data,
      userId: session.user.id,
    })
    .returning();

  return row;
}
