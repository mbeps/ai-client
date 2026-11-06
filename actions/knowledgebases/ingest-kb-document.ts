"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { kbDocument } from "@/drizzle/schemas/kb-document-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { inngest } from "@/lib/inngest/client";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Validates document ID payload for initiating document ingestion.
 *
 * @author Maruf Bepary
 */
const ingestKbDocumentSchema = z.object({
  documentId: z.string().uuid("Invalid document ID format"),
});

/**
 * Result returned by the document ingestion server action.
 *
 * @author Maruf Bepary
 */
export type IngestKbDocumentResult = {
  success: boolean;
  error?: string;
  code?: string;
};

/**
 * Next.js Server Action to trigger the ingestion process (extraction, chunking, embedding) for a document.
 * Returns a Result object indicating dispatch success or failure error message.
 *
 * @param documentId - UUID of the uploaded document to ingest
 * @returns Result resolving when ingestion background job is queued
 * @author Maruf Bepary
 */
export const ingestKbDocument = defineAction(
  async (documentId: string): Promise<Result<void, CommonError>> => {
    const session = await requireSession();

    // 1. Validate Input
    const validation = ingestKbDocumentSchema.safeParse({ documentId });
    if (!validation.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: validation.error.issues[0].message,
      });
    }
    const validatedId = validation.data.documentId;

    // 2. Validate Ownership
    const [doc] = await db
      .select({ id: kbDocument.id, kbId: kbDocument.kbId })
      .from(kbDocument)
      .where(
        and(
          eq(kbDocument.id, validatedId),
          eq(kbDocument.userId, session.user.id),
        ),
      );

    if (!doc) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Document not found or access denied",
      });
    }

    // 3. Execution via Inngest background job
    await db
      .update(kbDocument)
      .set({ status: "processing", statusMessage: null })
      .where(eq(kbDocument.id, validatedId));

    await inngest.send({
      name: "knowledgebase/document.ingest",
      data: {
        documentId: validatedId,
        userId: session.user.id,
        kbId: doc.kbId,
      },
    });

    return ok(undefined);
  },
);
