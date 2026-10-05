"use server";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { kbDocument, knowledgebase } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";
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
