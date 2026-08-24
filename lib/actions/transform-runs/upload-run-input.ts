"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { attachment } from "@/drizzle/schema";
import { uploadObject } from "@/lib/storage/upload-object";
import { randomUUID } from "crypto";
import {
  ALLOWED_SPREADSHEET_TYPES,
  MAX_SPREADSHEET_SIZE_BYTES,
} from "@/constants/attachments";
import { resolveMimeType } from "@/lib/attachments/resolve-mime-type";
import { checkRateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";

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

  const { allowed, retryAfterSeconds } = checkRateLimit(
    `upload:${session.user.id}`,
    env.RATE_LIMIT_UPLOAD_RPM,
  );
  if (!allowed) {
    throw new Error(`Too many uploads. Retry in ${retryAfterSeconds}s.`);
  }

  const files = formData.getAll("files") as File[];
  const results: { id: string; name: string }[] = [];

  for (const file of files) {
    const resolvedMimeType = await resolveMimeType(file);
    if (!ALLOWED_SPREADSHEET_TYPES.has(resolvedMimeType)) {
      throw new Error(
        `File type "${resolvedMimeType || "unknown"}" is not supported. Only spreadsheet files are allowed.`,
      );
    }
    if (file.size > MAX_SPREADSHEET_SIZE_BYTES) {
      throw new Error(`File "${file.name}" exceeds the maximum size of 50 MB.`);
    }
    const id = randomUUID();
    const key = `transform-inputs/${session.user.id}/${id}-${file.name}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    // Persist the sniffed MIME type, never the client-supplied file.type.
    await uploadObject(key, buffer, resolvedMimeType);

    const [row] = await db
      .insert(attachment)
      .values({
        id,
        messageId: null,
        transformRunId: null,
        userId: session.user.id,
        name: file.name,
        mimeType: resolvedMimeType,
        size: file.size,
        key,
      })
      .returning();

    results.push({ id: row.id, name: row.name });
  }

  return results;
}
