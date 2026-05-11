"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { knowledgebase } from "@/drizzle/schema";
import { eq, desc } from "drizzle-orm";
import type { KnowledgebaseRow } from "@/types/knowledgebase-row";

export async function listKnowledgebases(): Promise<KnowledgebaseRow[]> {
  const session = await requireSession();

  return db
    .select()
    .from(knowledgebase)
    .where(eq(knowledgebase.userId, session.user.id))
    .orderBy(desc(knowledgebase.updatedAt));
}
