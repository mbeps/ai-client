import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { s3Client, S3_BUCKET } from "./s3-instance";

/**
 * Deletes multiple objects from S3 storage in a single batch request.
 * Efficiently removes all files associated with a deleted chat or message.
 * No-op if keys array is empty.
 *
 * @param keys - Array of S3 object keys to delete
 * @throws {Error} When batch deletion fails (network, credentials, bucket permissions)
 * @see {@link deleteObject} for single object deletion
 */
export async function deleteObjects(keys: string[]) {
  if (keys.length === 0) return;
  await s3Client.send(
    new DeleteObjectsCommand({
      Bucket: S3_BUCKET,
      Delete: { Objects: keys.map((Key) => ({ Key })) },
    }),
  );
}
