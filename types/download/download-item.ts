/**
 * Broad categories of downloadable items.
 *
 * @author Maruf Bepary
 */
export type DownloadItemType =
  | "spreadsheet"
  | "document"
  | "archive"
  | "code"
  | "image"
  | "audio"
  | "video"
  | "file";

/**
 * Normalized representation of a downloadable file or asset extracted
 * from tool results, storage buckets, or message content.
 *
 * @author Maruf Bepary
 */
export interface DownloadItem {
  /** Unique identifier for the item (URL or composite id). */
  id: string;
  /** Human-readable title or filename. */
  title: string;
  /** Full URL for downloading the resource. */
  url: string;
  /** Categorized file type. */
  type: DownloadItemType;
  /** Optional file extension without dot (e.g. "xlsx", "pdf"). */
  extension?: string;
  /** File size in bytes if known. */
  size?: number;
  /** Source or origin of the download (tool name, "Storage", "Link"). */
  source?: string;
  /** MIME type if provided. */
  mimeType?: string;
  /** Timestamp when resource was created or message was sent. */
  createdAt?: Date | string;
  /** Message id this download belongs to. */
  messageId?: string;
}
