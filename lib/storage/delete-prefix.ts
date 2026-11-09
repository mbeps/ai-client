import { DeleteObjectsCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getLogger } from "@/lib/logger";
import { S3_BUCKET, s3Client } from "@/lib/storage/s3-instance";

const log = getLogger(["app", "storage", "delete-prefix"]);

/**
 * Deletes all objects matching a given key prefix from S3 storage.
 * Best-effort: errors are logged as warnings and do not throw.
 *
 * @param prefix - Key prefix to delete (e.g. `kb/kb-1/images/doc-1/`)
 * @author Maruf Bepary
 */
export async function deleteS3Prefix(prefix: string): Promise<void> {
  if (!prefix) return;

  try {
    const listRes = await s3Client.send(
      new ListObjectsV2Command({
        Bucket: S3_BUCKET,
        Prefix: prefix,
      }),
    );

    const keys = (listRes.Contents || [])
      .map((obj) => obj.Key)
      .filter((k): k is string => Boolean(k));

    if (keys.length === 0) return;

    await s3Client.send(
      new DeleteObjectsCommand({
        Bucket: S3_BUCKET,
        Delete: {
          Objects: keys.map((Key) => ({ Key })),
          Quiet: true,
        },
      }),
    );

    log.debug("Deleted {count} S3 objects under prefix {prefix}", {
      count: keys.length,
      prefix,
    });
  } catch (error) {
    log.warn("Failed to delete S3 prefix {prefix}: {error}", {
      prefix,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
