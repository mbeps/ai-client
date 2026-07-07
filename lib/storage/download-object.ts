import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client, S3_BUCKET } from "./s3-instance";

/**
 * Downloads a complete file object from S3 into memory.
 * Collects all chunks from the response stream into a single Buffer.
 * Used for processing attachments or preparing data for tools.
 *
 * @param key - S3 object key to download
 * @returns File data as Node.js Buffer
 * @throws {Error} When download fails, connection drops, or response body is empty
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
