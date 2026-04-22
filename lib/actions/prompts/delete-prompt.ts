"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { prompt } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";

export async function deletePrompt(id: string): Promise<void> {
  const session = await requireSession();

  const [row] = await db
    .delete(prompt)
    .where(and(eq(prompt.id, id), eq(prompt.userId, session.user.id)))
    .returning();

  if (!row) throw new Error("Not Found");
}
