"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { knowledgebase, kbDocument } from "@/drizzle/schema";
import { and, eq, desc } from "drizzle-orm";
import type { KbDocumentRow } from "@/types/knowledgebase/kb-document-row";

export async function listDocuments(kbId: string): Promise<KbDocumentRow[]> {
  const session = await requireSession();

  const [kb] = await db
    .select({ id: knowledgebase.id })
    .from(knowledgebase)
    .where(
      and(
        eq(knowledgebase.id, kbId),
        eq(knowledgebase.userId, session.user.id),
      ),
    );

  if (!kb) throw new Error("Not Found");

  return db
    .select()
    .from(kbDocument)
    .where(eq(kbDocument.kbId, kbId))
    .orderBy(desc(kbDocument.createdAt));
}
