"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { kbDocument } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { s3Client, S3_BUCKET } from "@/lib/storage/s3-client";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { deleteDocumentSchema } from "@/schemas/knowledgebase/knowledgebase";
import { z } from "zod";

/**
 * Deletes a document from a knowledge base and marks the knowledge base as needing re-indexing.
 * Validates document and knowledge base ownership before deletion.
 * Cascade-deletes the S3 object key reference (actual S3 cleanup handled separately).
 * Automatically sets knowledge base indexStatus to "stale" to trigger re-embedding.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param kbId - UUID of the knowledge base containing the document; must be owned by the authenticated user.
 * @param documentId - UUID of the document to delete.
 * @returns void (no return value).
 * @throws Error if session is not authenticated.
 * @throws Error if knowledge base is not found or user does not own it (returns "Not Found").
 * @throws Error if document is not found or does not belong to the knowledge base.
 * @throws Error if database deletion fails due to constraints or connection issues.
 * @see listDocuments to view documents in a knowledge base.
 * @see uploadKbDocument to add a new document.
 * @author Maruf Bepary
 */
export async function deleteDocument(
  data: z.infer<typeof deleteDocumentSchema>,
): Promise<void> {
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

  if (!doc) throw new Error("Not Found");

  await s3Client.send(
    new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: doc.s3Key }),
  );

  await db.delete(kbDocument).where(eq(kbDocument.id, validated.documentId));
}
