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
