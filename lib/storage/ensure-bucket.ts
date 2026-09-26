import { CreateBucketCommand, HeadBucketCommand } from "@aws-sdk/client-s3";
import { S3_BUCKET, s3Client } from "./s3-instance";

// ponytail: process-scoped cache; upgrade to distributed lock if multi-instance
let bucketVerified = false;

/**
 * Verifies S3 bucket exists, creating it if not found.
 * Called during app initialization to ensure storage is ready.
 * Gracefully handles NotFound (404) errors by creating the bucket.
 * Cached per-process to avoid repeated HEAD requests on every upload.
 *
 * @throws {Error} When bucket check fails for reasons other than missing bucket
 * @see {@link s3-client.ts} for bucket creation implementation
 */
export async function ensureBucket() {
  if (bucketVerified) return;
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
  bucketVerified = true;
}
