import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { S3_BUCKET, s3Client } from "./s3-instance";

/**
 * Deletes a single object from S3 storage.
 * Used when removing individual attachment files on message deletion.
 *
 * @param key - S3 object key to delete
 * @throws {Error} When deletion fails (network, credentials, bucket permissions)
 * @see {@link deleteObjects} for batch deletion
 */
export async function deleteObject(key: string) {
  await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: key }));
}
