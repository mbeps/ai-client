import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@/lib/env";
import { S3_BUCKET, s3Client } from "./s3-instance";

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
export async function getPresignedUrl(key: string, expiresIn?: number) {
  const expiry = expiresIn ?? env.PRESIGNED_URL_EXPIRY_SECONDS ?? 3600;
  return getSignedUrl(
    s3Client,
    new GetObjectCommand({ Bucket: S3_BUCKET, Key: key }),
    { expiresIn: expiry },
  );
}
