"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { prompt } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { PromptRow } from "@/types/prompt-row";

export async function getPrompt(id: string): Promise<PromptRow> {
  const session = await requireSession();

  const [row] = await db
    .select()
    .from(prompt)
    .where(and(eq(prompt.id, id), eq(prompt.userId, session.user.id)));

  if (!row) throw new Error("Not Found");

  return row;
}
