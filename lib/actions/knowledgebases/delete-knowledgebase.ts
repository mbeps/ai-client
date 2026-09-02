"use server";

import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { kbDocument, knowledgebase } from "@/drizzle/schema";
import { deleteEntityFactory } from "@/lib/actions/shared/delete-entity-factory";
import { requireSession } from "@/lib/auth/require-session";
import { logger } from "@/lib/logger";
import { S3_BUCKET, s3Client } from "@/lib/storage/s3-instance";

const deleteKbRow = deleteEntityFactory({ table: knowledgebase });

/**
 * Deletes one or more knowledge bases owned by the authenticated user.
 * Fetches document S3 keys BEFORE deletion (documents cascade-delete with the KB),
 * deletes the KB row via the shared factory (ownership enforced), then best-effort
 * removes each S3 object — S3 failures are logged but do not fail the delete
 * (orphaned objects are acceptable; blocking the user is not).
 *
 * @param idOrIds - UUID or array of UUIDs of the knowledge bases to delete; must be owned by the authenticated user.
 * @returns { deletedCount: number } - The number of knowledge bases successfully deleted.
 * @throws Error if session is not authenticated (requireSession call fails).
 * @throws Error if knowledge base is not found or user does not own it (ownership check enforced via session).
 * @see createKnowledgebase to create a new knowledge base.
 * @see updateKnowledgebase to modify knowledge base settings.
 * @author Maruf Bepary
 */
export async function deleteKnowledgebase(
  idOrIds: string | string[],
): Promise<{ deletedCount: number }> {
  const session = await requireSession();
  const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];

  if (ids.length === 0) return { deletedCount: 0 };

  // Fetch keys before the DB delete — kb_document rows cascade away with the KB.
  const docs = await db
    .select({ s3Key: kbDocument.s3Key })
    .from(kbDocument)
    .where(
      and(
        inArray(kbDocument.kbId, ids),
        eq(kbDocument.userId, session.user.id),
      ),
    );

  const result = await deleteKbRow(idOrIds);

  // ponytail: sequential best-effort S3 cleanup; ceiling is slow deletes for
  // huge KBs — upgrade path is batch DeleteObjectsCommand if that matters.
  for (const doc of docs) {
    try {
      await s3Client.send(
        new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: doc.s3Key }),
      );
    } catch (err) {
      logger.warn(`Failed to delete S3 object for deleted knowledge base`, {
        err,
        key: doc.s3Key,
      });
    }
  }

  return result;
}
