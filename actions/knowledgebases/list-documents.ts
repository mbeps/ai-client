"use server";

import { and, desc, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { kbDocument } from "@/drizzle/schemas/kb-document-schema";
import { knowledgebase } from "@/drizzle/schemas/knowledgebase-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { KbDocumentRow } from "@/types/knowledgebase/kb-document-row";
import type { Result } from "@/types/result";

/**
 * Lists KB documents (newest first) with status, chunk/token counts after validating ownership.
 *
 * @async
 * @param kbId - Knowledge base UUID
 * @returns Result containing documents ordered by createdAt DESC
 * @author Maruf Bepary
 */
export const listDocuments = defineAction(
  async (kbId: string): Promise<Result<KbDocumentRow[], CommonError>> => {
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

    if (!kb) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Not Found",
      });
    }

    const docs = await db
      .select()
      .from(kbDocument)
      .where(eq(kbDocument.kbId, kbId))
      .orderBy(desc(kbDocument.createdAt));

    return ok(docs);
  },
);
