import { rm } from "fs/promises";

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
