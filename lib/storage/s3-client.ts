import { env } from "@/lib/env";
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

/**
 * AWS S3 client configured with MinIO or S3 endpoint, region, and credentials from environment.
 * Used for all file upload/download/delete operations throughout the application.
 * Configured with forcePathStyle=true for MinIO compatibility.
 *
 * @see {@link env.ts} for S3_ENDPOINT, S3_REGION, S3_ACCESS_KEY, S3_SECRET_KEY
 */
export const s3Client = new S3Client({
  endpoint: env.S3_ENDPOINT,
  region: env.S3_REGION,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY,
    secretAccessKey: env.S3_SECRET_KEY,
  },
  forcePathStyle: true,
});

/**
 * S3 bucket name for all file storage, configured from environment.
 */
export const S3_BUCKET = env.S3_BUCKET;

/**
 * Verifies S3 bucket exists, creating it if not found.
 * Called during app initialization to ensure storage is ready.
 * Gracefully handles NotFound (404) errors by creating the bucket.
 *
 * @throws {Error} When bucket check fails for reasons other than missing bucket
 * @see {@link s3-client.ts} for bucket creation implementation
 */
export async function ensureBucket() {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: S3_BUCKET }));
  } catch (err: unknown) {
    const error = err as {
      name?: string;
      $metadata?: { httpStatusCode?: number };
    };
    if (error.name === "NotFound" || error.$metadata?.httpStatusCode === 404) {
      await s3Client.send(new CreateBucketCommand({ Bucket: S3_BUCKET }));
    } else {
      throw err;
    }
  }
}

/**
 * Uploads a file object to S3 storage.
 * Used when persisting user-submitted attachments and modified files from MCP processing.
 * Automatically sets ContentType header for proper MIME handling.
 *
 * @param key - S3 object key (full path), typically formatted as attachments/{userId}/{id}-{filename}
 * @param body - File data as Buffer or Uint8Array
 * @param contentType - MIME type for the object (e.g., image/png, application/pdf)
 * @throws {Error} When S3 upload fails (network, credentials, bucket permissions)
 * @see {@link file-bridge.ts} for MCP file re-upload after modification
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

/**
 * Generates a time-limited presigned URL for downloading an S3 object.
 * Presigned URLs allow temporary unauthenticated access without storing additional credentials,
 * used to fetch attachment previews and downloads from the browser.
 * Default expiry is 1 hour; pass custom expiresIn for different durations.
 *
 * @param key - S3 object key to generate download URL for
 * @param expiresIn - URL expiry duration in seconds (default: 3600 = 1 hour)
 * @returns Full presigned URL string that can be shared for temporary access
 * @throws {Error} When URL signing fails (invalid key, credentials, etc.)
 * @see {@link message-bubble.tsx} for presigned URL fetching on component mount
 */
export async function getPresignedUrl(key: string, expiresIn = 3600) {
  return getSignedUrl(
    s3Client,
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
    { expiresIn },
  );
}

/**
 * Downloads a complete file object from S3 into memory.
 * Collects all chunks from the response stream into a single Buffer.
 * Used during file bridge operations to stage attachments for MCP tool processing.
 *
 * @param key - S3 object key to download
 * @returns File data as Node.js Buffer
 * @throws {Error} When download fails, connection drops, or response body is empty
 * @see {@link file-bridge.ts} for file staging during MCP processing
 */
export async function downloadObject(key: string): Promise<Buffer> {
  const response = await s3Client.send(
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
  );
  const stream = response.Body;
  if (!stream) throw new Error(`Empty body for key "${key}"`);
  const chunks: Uint8Array[] = [];
  for await (const chunk of stream as AsyncIterable<Uint8Array>) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}
