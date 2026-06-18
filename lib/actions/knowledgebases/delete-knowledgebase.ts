"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { knowledgebase } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";

export async function deleteKnowledgebase(id: string): Promise<void> {
  const session = await requireSession();

  const [row] = await db
    .delete(knowledgebase)
    .where(
      and(eq(knowledgebase.id, id), eq(knowledgebase.userId, session.user.id)),
    )
    .returning({ id: knowledgebase.id });

  if (!row) {
    throw new Error("Not Found");
  }
}
