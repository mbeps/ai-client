"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";
import { knowledgebase, kbDocument } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { uploadObject, ensureBucket } from "@/lib/storage/s3-client";
import type { KbDocumentRow } from "@/types/kb-document-row";

const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "text/plain",
  "text/markdown",
]);

const MAX_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]/g, "_")
    .replace(/_{2,}/g, "_")
    .slice(0, 200);
}

export async function uploadKbDocument(
  formData: FormData,
): Promise<KbDocumentRow> {
  const session = await requireSession();

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

  if (!kb) throw new Error("Knowledgebase not found");

  const mimeType = file.type || "application/octet-stream";
  if (!ALLOWED_MIME_TYPES.has(mimeType)) {
    throw new Error(
      `File type "${mimeType}" is not supported. Use PDF, plain text, or Markdown.`,
    );
  }

  if (file.size > MAX_SIZE_BYTES) {
    throw new Error("File exceeds the 50 MB size limit.");
  }

  const documentId = crypto.randomUUID();
  const safeName = sanitizeFilename(file.name);
  const s3Key = `kb/${kbId}/${documentId}/${safeName}`;

  await ensureBucket();
  const buffer = Buffer.from(await file.arrayBuffer());
  await uploadObject(s3Key, buffer, mimeType);

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

  await db
    .update(knowledgebase)
    .set({
      indexStatus: "stale",
      updatedAt: new Date(),
    })
    .where(eq(knowledgebase.id, kbId));

  return row;
}
