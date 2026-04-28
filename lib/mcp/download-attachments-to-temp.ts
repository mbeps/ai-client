import { mkdir, writeFile, stat, rm } from "fs/promises";
import { join, basename } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";
import { downloadObject } from "@/lib/storage/s3-client";
import { BridgedFile } from "@/types/bridged-file";
import { FileBridgeResult } from "@/types/file-bridge-result";

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
