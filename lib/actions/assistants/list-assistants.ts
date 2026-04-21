"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { assistant } from "@/drizzle/schema";
import { eq, desc } from "drizzle-orm";
import type { AssistantRow } from "@/types/assistant-row";

export async function listAssistants(): Promise<AssistantRow[]> {
  const session = await requireSession();

  return db
    .select()
    .from(assistant)
    .where(eq(assistant.userId, session.user.id))
    .orderBy(desc(assistant.updatedAt));
}
