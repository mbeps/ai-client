import { mkdir, writeFile, stat, rm, readFile } from "fs/promises";
import { join, basename } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { downloadObject, uploadObject } from "@/lib/storage/s3-client";
import { db } from "@/drizzle/db";
import { attachment } from "@/drizzle/schema";
import { spreadsheetMimeFromName } from "@/lib/attachments/spreadsheet-types";

/**
 * File staged in temporary directory for MCP processing.
 * Tracks original metadata to detect modifications after MCP tool execution.
 */
export type BridgedFile = {
  attachmentId: string;
  originalName: string;
  localPath: string;
  originalSize: number;
  originalMtimeMs: number;
};

/**
 * Result of downloading attachments to temporary staging directory.
 */
export type FileBridgeResult = {
  tempDir: string;
  files: BridgedFile[];
};

/**
 * New attachment created from a file modified by MCP tools.
 */
export type ModifiedAttachment = {
  attachmentId: string;
  newAttachmentId: string;
  newKey: string;
  name: string;
  size: number;
  mimeType: string;
};

const BRIDGE_ROOT = "mcp-bridge";

/**
 * Downloads attachments from S3 storage to a temporary staging directory for MCP tool access.
 * Creates isolated subdirectories per attachment with original file metadata preserved for change detection.
 * Continues on individual download failures but throws if all downloads fail.
 *
 * @param attachments - Array of S3 attachment references (id, key, name)
 * @returns Staging directory path and array of bridged files with original metadata
 * @throws {Error} When all attachments fail to download
 * @see {@link s3-client.ts} for S3 download implementation
 * @see {@link persistModifiedFiles} for processing modified files back to S3
 */
export async function downloadAttachmentsToTemp(
  attachments: { id: string; key: string; name: string }[],
): Promise<FileBridgeResult> {
  const tempDir = join(tmpdir(), BRIDGE_ROOT, randomUUID());
  await mkdir(tempDir, { recursive: true });

  const files: BridgedFile[] = [];
  const errors: unknown[] = [];

  for (const att of attachments) {
    try {
      const safeName = basename(att.name);
      const subdir = join(tempDir, att.id);
      await mkdir(subdir, { recursive: true });
      const localPath = join(subdir, safeName);

      const buffer = await downloadObject(att.key);
      await writeFile(localPath, buffer);
      const s = await stat(localPath);

      files.push({
        attachmentId: att.id,
        originalName: safeName,
        localPath,
        originalSize: s.size,
        originalMtimeMs: s.mtimeMs,
      });
    } catch (err) {
      errors.push(err);
      console.warn(
        `[FileBridge] Failed to download attachment ${att.id} (${att.name}):`,
        err,
      );
    }
  }

  if (files.length === 0 && errors.length > 0) {
    await rm(tempDir, { recursive: true, force: true }).catch(() => {});
    throw new Error("All file bridge downloads failed");
  }

  return { tempDir, files };
}

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

/**
 * Removes temporary staging directory and all contents after MCP processing completes.
 * Uses force flag to suppress errors if directory no longer exists.
 *
 * @param tempDir - Absolute path to temporary directory created by downloadAttachmentsToTemp()
 * @see {@link downloadAttachmentsToTemp} for directory creation
 */
export async function cleanupTempDir(tempDir: string): Promise<void> {
  await rm(tempDir, { recursive: true, force: true });
}
