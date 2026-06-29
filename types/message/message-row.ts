import { type InferSelectModel } from "drizzle-orm";
import { message } from "@/drizzle/schema";

/**
 * Database representation of a message in a branching conversation tree from the Drizzle schema.
 * Supports tree structure via parentId for creating multi-path conversations.
 * Metadata stores JSON-serialized tool calls, reasoning tokens, and extended-thinking data.
 * Users can explore alternative response branches from a single message.
 *
 * @see {@link types/message/message.ts} for the enriched Message type with attachments
 * @see {@link types/chat/chat-row.ts} for parent chat row
 * @author Maruf Bepary
 */
export type MessageRow = InferSelectModel<typeof message>;
