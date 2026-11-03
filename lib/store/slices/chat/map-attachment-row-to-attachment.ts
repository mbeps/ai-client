import { ALLOWED_SPREADSHEET_TYPES } from "@/config/attachments";
import type { Attachment } from "@/types/attachment/attachment";
import type { AttachmentRow } from "@/types/attachment/attachment-row";

/**
 * Transforms a raw attachment row from the database into the store's Attachment shape.
 *
 * @param att - Raw attachment row from the database
 * @returns Formatted Attachment domain object
 * @author Maruf Bepary
 */
export function mapAttachmentRowToAttachment(att: AttachmentRow): Attachment {
  const isImage = att.mimeType.startsWith("image/");
  const isSpreadsheet = ALLOWED_SPREADSHEET_TYPES.has(att.mimeType);
  return {
    id: att.id,
    type: isImage ? "image" : isSpreadsheet ? "spreadsheet" : "document",
    name: att.name,
    mimeType: att.mimeType,
    sizeBytes: att.size,
    dataUrl: "",
    key: att.key,
    extractedText: att.extractedText ?? undefined,
  };
}
