import { mkdir, writeFile, stat, rm, readFile } from "fs/promises";
import { join, basename } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { downloadObject, uploadObject } from "@/lib/storage/s3-client";
import { db } from "@/drizzle/db";
import { attachment } from "@/drizzle/schema";
import { spreadsheetMimeFromName } from "@/lib/attachments/spreadsheet-types";

export type BridgedFile = {
  attachmentId: string;
  originalName: string;
  localPath: string;
  originalSize: number;
  originalMtimeMs: number;
};

export type FileBridgeResult = {
  tempDir: string;
  files: BridgedFile[];
};

export type ModifiedAttachment = {
  attachmentId: string;
  newAttachmentId: string;
  newKey: string;
  name: string;
  size: number;
  mimeType: string;
};

const BRIDGE_ROOT = "mcp-bridge";

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

export async function cleanupTempDir(tempDir: string): Promise<void> {
  await rm(tempDir, { recursive: true, force: true });
}
