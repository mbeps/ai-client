"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { knowledgebase, kbDocument } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { uploadObject } from "@/lib/storage/upload-object";
import { ensureBucket } from "@/lib/storage/ensure-bucket";
import { sanitiseFilename } from "@/lib/utils/sanitise-filename";
import { resolveMimeType } from "@/lib/attachments/resolve-mime-type";
import type { KbDocumentRow } from "@/types/knowledgebase/kb-document-row";
import { checkRateLimit } from "@/lib/rate-limit";
import { env } from "@/lib/env";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
]);

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

/**
 * Validates file (type, size), uploads to S3, creates pending document, marks KB stale.
 * Supports PDF, text, Markdown up to 50MB.
 *
 * @async
 * @param formData - {file: File, kbId: string}
 * @returns Created document record with pending status
 * @throws If file missing, KB not owned, MIME invalid, or size exceeds 50MB
 * @author Maruf Bepary
 */
export async function uploadKbDocument(
  formData: FormData,
): Promise<KbDocumentRow> {
  const session = await requireSession();

  const { allowed, retryAfterSeconds } = checkRateLimit(
    `upload:${session.user.id}`,
    env.RATE_LIMIT_UPLOAD_RPM,
  );
  if (!allowed) {
    throw new Error(`Too many uploads. Retry in ${retryAfterSeconds}s.`);
  }

  const file = formData.get("file") as File | null;
  const kbId = formData.get("kbId") as string | null;

  if (!file) throw new Error("No file provided");
  if (!kbId) throw new Error("No kbId provided");

  const [kb] = await db
    .select({ id: knowledgebase.id })
    .from(knowledgebase)
    .where(
      and(
        eq(knowledgebase.id, kbId),
        eq(knowledgebase.userId, session.user.id),
      ),
    );

  if (!kb) throw new Error("Not Found");

  // Magic-byte-sniffed type is authoritative; rejects spoofed Content-Type.
  const mimeType = await resolveMimeType(file);
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error(
      `File type "${mimeType}" is not supported. Use PDF, plain text, or Markdown.`,
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    throw new Error("File exceeds the 50 MB size limit.");
  }

  const documentId = crypto.randomUUID();
  const safeName = sanitiseFilename(file.name);
  const s3Key = `kb/${kbId}/${documentId}/${safeName}`;

  await ensureBucket();
  const buffer = Buffer.from(await file.arrayBuffer());

  // DB-first: insert the row, then upload; compensate by deleting the row if
  // S3 fails so a failed upload never leaves a dangling pending document.
  const [row] = await db
    .insert(kbDocument)
    .values({
      id: documentId,
      kbId,
      userId: session.user.id,
      name: file.name,
      mimeType,
      size: file.size,
      s3Key,
      status: "pending",
    })
    .returning();

  try {
    await uploadObject(s3Key, buffer, mimeType);
  } catch (err) {
    await db.delete(kbDocument).where(eq(kbDocument.id, documentId));
    throw err;
  }

  await db
    .update(knowledgebase)
    .set({
      indexStatus: "stale",
      updatedAt: new Date(),
    })
    .where(eq(knowledgebase.id, kbId));

  return row;
}
