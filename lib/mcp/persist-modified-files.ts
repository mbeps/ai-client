import { stat, readFile } from "fs/promises";
import { randomUUID } from "crypto";
import { uploadObject } from "@/lib/storage/s3-client";
import { db } from "@/drizzle/db";
import { attachment } from "@/drizzle/schema";
import { spreadsheetMimeFromName } from "@/lib/attachments/spreadsheet-types";
import { BridgedFile } from "@/types/bridged-file";
import { ModifiedAttachment } from "@/types/modified-attachment";

/**
 * Re-uploads files modified by MCP tools back to S3 and persists new attachment records to database.
 * Detects modifications by comparing file size and mtime against original metadata.
 * Skips unchanged files, automatically determines MIME type from filename, and generates presigned URLs.
 * Continues on individual persistence failures, collecting successfully processed files.
 *
 * @param params - Object containing staged files, user ID, and assistant message ID for DB linking
 * @returns Array of newly created attachments that were modified and persisted
 * @throws {Error} May log warnings for individual failures but completes even if some persist operations fail
 * @see {@link s3-client.ts} for S3 upload and MIME type resolution
 * @see {@link downloadAttachmentsToTemp} for initial staging process
 */
export async function persistModifiedFiles(params: {
  files: BridgedFile[];
  userId: string;
  assistantMessageId: string;
}): Promise<ModifiedAttachment[]> {
  const { files, userId, assistantMessageId } = params;
  const results: ModifiedAttachment[] = [];

  for (const f of files) {
    let s;
    try {
      s = await stat(f.localPath);
    } catch {
      continue;
    }

    const changed =
      s.size !== f.originalSize || s.mtimeMs !== f.originalMtimeMs;
    if (!changed) continue;

    try {
      const buffer = await readFile(f.localPath);
      const newAttachmentId = randomUUID();
      const newKey = `attachments/${userId}/${newAttachmentId}-${f.originalName}`;
      const mimeType = spreadsheetMimeFromName(f.originalName);

      await uploadObject(newKey, buffer, mimeType);

      await db.insert(attachment).values({
        id: newAttachmentId,
        messageId: assistantMessageId,
        userId,
        name: f.originalName,
        mimeType,
        size: s.size,
        key: newKey,
      });

      results.push({
        attachmentId: f.attachmentId,
        newAttachmentId,
        newKey,
        name: f.originalName,
        size: s.size,
        mimeType,
      });
    } catch (err) {
      console.warn(
        `[FileBridge] Failed to persist modified file ${f.originalName}:`,
        err,
      );
    }
  }

  return results;
}
