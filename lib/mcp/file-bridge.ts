/**
 * FileBridge — downloads spreadsheet attachments from S3 to a temporary local
 * directory so that stdio MCP servers (e.g. @negokaz/excel-mcp-server) can
 * access them via the filesystem.
 *
 * Usage per request:
 *   const bridge = await downloadAttachmentsToTemp(spreadsheetAtts);
 *   // inject bridge.tempDir into EXCEL_MCP_ALLOWED_DIRS
 *   // pass bridge.files[].localPath as tool arguments
 *   // await bridge.cleanup() in finally block
 */

import fs from "fs/promises";
import path from "path";
import { v4 as uuidv4 } from "uuid";
import { s3Client, S3_BUCKET } from "@/lib/storage/s3-client";
import { GetObjectCommand } from "@aws-sdk/client-s3";

export type BridgeFile = {
  originalName: string;
  localPath: string;
};

export type FileBridgeResult = {
  tempDir: string;
  files: BridgeFile[];
  cleanup: () => Promise<void>;
};

type SpreadsheetAtt = {
  name: string;
  key?: string;
};

/**
 * Downloads spreadsheet attachments from S3 to a per-request temp directory.
 * Returns the temp dir path, local file paths, and a cleanup function.
 */
export async function downloadAttachmentsToTemp(
  attachments: SpreadsheetAtt[],
): Promise<FileBridgeResult> {
  const tempDir = path.join("/tmp", "mcp-bridge", uuidv4());
  await fs.mkdir(tempDir, { recursive: true });

  const files: BridgeFile[] = [];

  for (const att of attachments) {
    if (!att.key) continue;

    try {
      const cmd = new GetObjectCommand({ Bucket: S3_BUCKET, Key: att.key });
      const response = await s3Client.send(cmd);

      if (!response.Body) {
        console.warn(`[FileBridge] Empty body for key: ${att.key}`);
        continue;
      }

      // Stream body to buffer
      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);

      const localPath = path.join(tempDir, att.name);
      await fs.writeFile(localPath, buffer);
      files.push({ originalName: att.name, localPath });
    } catch (err) {
      console.warn(`[FileBridge] Failed to download ${att.key}:`, err);
    }
  }

  const cleanup = async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (err) {
      console.warn(`[FileBridge] Failed to cleanup ${tempDir}:`, err);
    }
  };

  return { tempDir, files, cleanup };
}
