"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { knowledgebase } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import type { KnowledgebaseRow } from "@/types/knowledgebase-row";

export async function getKnowledgebase(
  id: string,
): Promise<KnowledgebaseRow | null> {
  const session = await requireSession();

  const [row] = await db
    .select()
    .from(knowledgebase)
    .where(
      and(eq(knowledgebase.id, id), eq(knowledgebase.userId, session.user.id)),
    );

  return row ?? null;
}
