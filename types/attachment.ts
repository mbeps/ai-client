/**
 * A file attachment on a message — images and documents.
 */
export type Attachment = {
  id: string;
  type: "image" | "document" | "spreadsheet";
  name: string;
  mimeType: string;
  sizeBytes: number;
  dataUrl: string;
  extractedText?: string;
  key?: string;
  url?: string;
};
