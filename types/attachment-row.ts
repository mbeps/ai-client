import { type InferSelectModel } from "drizzle-orm";
import { attachment } from "../drizzle/schema";

/**
 * Database representation of an uploaded file (image, PDF, text, spreadsheet) linked to a message from the drizzle schema.
 * key is the unique S3 object path; mimeType and size enable validation and rendering in chat UI.
 *
 * @see {@link ../drizzle/schemas/chat-schema.ts} for database definition
 * @author Maruf Bepary
 */
export type AttachmentRow = InferSelectModel<typeof attachment>;
