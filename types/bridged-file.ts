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
