"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { knowledgebase, kbDocument } from "@/drizzle/schema";
import { and, eq, desc } from "drizzle-orm";
import type { KbDocumentRow } from "@/types/knowledgebase/kb-document-row";

/**
 * Lists KB documents (newest first) with status, chunk/token counts after validating ownership.
 *
 * @async
 * @param kbId - Knowledge base UUID
 * @returns Documents ordered by createdAt DESC
 * @throws "Not Found" if KB not owned by current user
 * @author Maruf Bepary
 */
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
