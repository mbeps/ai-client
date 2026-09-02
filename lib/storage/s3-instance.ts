import { S3Client } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";

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
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
});

/**
 * S3 bucket name for all file storage, configured from environment.
 */
export const S3_BUCKET = env.S3_BUCKET;
