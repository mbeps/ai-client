import { db } from "@/drizzle/db";
import { attachment } from "@/drizzle/schema";
import { logger } from "@/lib/logger";
import { deleteObject } from "./delete-object";
import { inArray, sql } from "drizzle-orm";

/**
 * Deletes S3 objects for attachment keys that are no longer referenced by any
 * `attachment` row. Keys may be shared across cloned rows (see
 * `cloneAttachmentsBatch`), so a key is only deleted when its reference count
 * drops to zero. Best-effort: failures are logged and never thrown — a leaked
 * blob is recoverable, a wrongly deleted blob is data loss.
 *
 * @param keys - Attachment S3 keys to sweep.
 */
export async function sweepOrphanedAttachmentKeys(
  keys: string[],
): Promise<void> {
  const uniqueKeys = [...new Set(keys)];
  if (uniqueKeys.length === 0) return;

  try {
    const counts = await db
      .select({ key: attachment.key, count: sql<number>`count(*)::int` })
      .from(attachment)
      .where(inArray(attachment.key, uniqueKeys))
      .groupBy(attachment.key);

    const referenced = new Set(counts.map((c) => c.key));
    const orphans = uniqueKeys.filter((k) => !referenced.has(k));

    await Promise.all(
      orphans.map(async (key) => {
        try {
          await deleteObject(key);
        } catch (error) {
          logger.error("Failed to delete orphaned S3 object", { key, error });
        }
      }),
    );
  } catch (error) {
    logger.error("Failed to count attachment references for S3 sweep", {
      error,
    });
  }
}
