"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { assistant } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";

export async function deleteAssistant(id: string): Promise<void> {
  const session = await requireSession();

  await db
    .delete(assistant)
    .where(and(eq(assistant.id, id), eq(assistant.userId, session.user.id)));
}
