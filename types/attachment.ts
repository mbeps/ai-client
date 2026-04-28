/**
 * Represents a file attachment (image, document, or spreadsheet) uploaded to a message.
 * Attachments are processed for content extraction and stored in MinIO S3 storage.
 * Supports images (jpg, png, gif), documents (pdf, txt), and spreadsheets (xlsx).
 * File size limits: 2MB (images), 20MB (documents), 50MB (spreadsheets).
 *
 * @see Message for the message containing this attachment
 * @author Maruf Bepary
 */
export type Attachment = {
  /** Unique identifier for this attachment (UUID). */
  id: string;

  /** File category: image (jpg/png/gif), document (pdf/txt), or spreadsheet (xlsx). */
  type: "image" | "document" | "spreadsheet";

  /** Original filename provided by the user during upload. */
  name: string;

  /** MIME type of the file (e.g., "image/jpeg", "application/pdf"). */
  mimeType: string;

  /** File size in bytes at time of upload. */
  sizeBytes: number;

  /**
   * Data URL or base64-encoded representation for client-side rendering.
   * Used for immediate preview in the UI without additional network requests.
   */
  dataUrl: string;

  /**
   * Text extracted from documents (PDF) or spreadsheets (XLSX) via content processors.
   * Injected into the AI prompt for multimodal understanding.
   * Undefined if extraction failed or not yet processed.
   */
  extractedText?: string;

  /** MinIO S3 object key (path) where the file is stored remotely. */
  key?: string;

  /** Presigned URL for direct download or viewing the file from S3. */
  url?: string;

  /**
   * Original File object from the browser (client-side only).
   * Used for re-upload or processing; not persisted to database.
   */
  rawFile?: File;
};
