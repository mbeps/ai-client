"use server";

import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/drizzle/db";
import { kbDocument } from "@/drizzle/schemas/kb-document-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { inngest } from "@/lib/inngest/client";
import { getLogger } from "@/lib/logger";
import { deletePointsByDocumentId } from "@/lib/rag/qdrant-client";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import { S3_BUCKET, s3Client } from "@/lib/storage/s3-instance";
import { deleteDocumentSchema } from "@/schemas/knowledgebase/knowledgebase";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

const log = getLogger(["app", "actions", "knowledgebases"]);

/**
 * Deletes a document from a knowledge base.
 * Validates document and knowledge base ownership before deletion.
 * Deletes the database row first, then removes the S3 object. If the S3
 * deletion fails, the document row is already gone — the S3 object becomes
 * orphaned but the knowledge base record stays consistent.
 * Does not change `indexStatus`; re-indexing is handled elsewhere.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param data - Object containing kbId and documentId of the document to delete
 * @returns Result resolving when document row and underlying S3 object are removed
 * @author Maruf Bepary
 */
export const deleteDocument = defineAction(
  async (
    data: z.infer<typeof deleteDocumentSchema>,
  ): Promise<Result<void, CommonError>> => {
    const session = await requireSession();

    const validated = deleteDocumentSchema.parse(data);

    const [doc] = await db
      .select()
      .from(kbDocument)
      .where(
        and(
          eq(kbDocument.id, validated.documentId),
          eq(kbDocument.userId, session.user.id),
        ),
      );

    if (!doc) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Not Found",
      });
    }

    await inngest.send({
      name: "knowledgebase/document.cancel",
      data: { documentId: validated.documentId },
    });

    await s3Client.send(
      new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: doc.s3Key }),
    );

    await db.delete(kbDocument).where(eq(kbDocument.id, validated.documentId));

    try {
      await deletePointsByDocumentId(validated.documentId);
    } catch (err) {
      log.warn(
        "Failed to delete Qdrant points for deleted document (documentId: {documentId})",
        {
          documentId: validated.documentId,
          error: err instanceof Error ? err.message : String(err),
        },
      );
    }

    log.info(
      "Deleted knowledge base document (documentId: {documentId}, kbId: {kbId})",
      {
        documentId: validated.documentId,
        kbId: doc.kbId,
      },
    );

    return ok(undefined);
  },
);
