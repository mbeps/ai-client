"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { prompt } from "@/drizzle/schema";
import { eq, desc } from "drizzle-orm";
import type { PromptRow } from "@/types/prompt-row";

export async function listPrompts(): Promise<PromptRow[]> {
  const session = await requireSession();

  return db
    .select()
    .from(prompt)
    .where(eq(prompt.userId, session.user.id))
    .orderBy(desc(prompt.updatedAt));
}
