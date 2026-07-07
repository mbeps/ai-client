import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, S3_BUCKET } from "./s3-instance";

/**
 * Uploads a file object to S3 storage.
 * Used when persisting user-submitted attachments and modified files from MCP processing.
 * Automatically sets ContentType header for proper MIME handling.
 *
 * @param key - S3 object key (full path), typically formatted as attachments/{userId}/{id}-{filename}
 * @param body - File data as Buffer or Uint8Array
 * @param contentType - MIME type for the object (e.g., image/png, application/pdf)
 * @throws {Error} When S3 upload fails (network, credentials, bucket permissions)
 * @see {@link persist-modified-files.ts} for MCP file re-upload after modification
 */
export async function uploadObject(
  key: string,
  body: Buffer | Uint8Array,
  contentType: string,
) {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}
