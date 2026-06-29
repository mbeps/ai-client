import { type InferSelectModel } from "drizzle-orm";
import { attachment } from "@/drizzle/schema";

/**
 * Database representation of an uploaded file (image, PDF, text, spreadsheet) linked to a message.
 * From the Drizzle schema; enables persistence and retrieval of file attachments.
 * key is the unique S3 object path for storage and download.
 * mimeType and size enable validation, rendering, and content type detection in chat UI.
 *
 * @see {@link types/attachment/attachment.ts} for enriched Attachment type with client-side data
 * @see {@link types/message/message-row.ts} for messages that contain attachments
 * @author Maruf Bepary
 */
export type AttachmentRow = InferSelectModel<typeof attachment>;
