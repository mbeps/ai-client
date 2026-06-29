"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { attachment } from "@/drizzle/schema";
import { uploadObject } from "@/lib/storage/s3-client";
import { randomUUID } from "crypto";

/**
 * Uploads multiple input files for a transform run to S3 and creates attachment records.
 * Processes multipart form data containing multiple files, stores each in S3 under user-scoped path.
 * Creates attachment records linked to the transform run for reference.
 * Runs on server only — receives multipart/form-data from client with multiple files.
 *
 * @param formData - Multipart form data with key 'files' (required File array).
 * @returns Array of created attachment objects with id and name.
 * @throws Error if no files provided in formData.
 * @throws Error if S3 upload fails for any file.
 * @throws Error if database insertion fails due to constraints or connection issues.
 * @author Maruf Bepary
 */
export async function uploadRunInput(
  formData: FormData,
): Promise<{ id: string; name: string }[]> {
  const session = await requireSession();
  const files = formData.getAll("files") as File[];
  const results: { id: string; name: string }[] = [];

  for (const file of files) {
    const id = randomUUID();
    const key = `transform-inputs/${session.user.id}/${id}-${file.name}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    await uploadObject(key, buffer, file.type || "application/octet-stream");

    const [row] = await db
      .insert(attachment)
      .values({
        id,
        messageId: null,
        transformRunId: null,
        userId: session.user.id,
        name: file.name,
        mimeType: file.type || "application/octet-stream",
        size: file.size,
        key,
      })
      .returning();

    results.push({ id: row.id, name: row.name });
  }

  return results;
}
