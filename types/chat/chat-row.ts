import { type InferSelectModel } from "drizzle-orm";
import { chat } from "@/drizzle/schema";

/**
 * Database representation of a chat session from the Drizzle schema.
 * Includes metadata for message tree tracking via currentLeafId.
 * Optional associations with projects and assistants enable resource-scoped chat behavior.
 * knowledgebaseId allows binding chats to knowledge bases for RAG context.
 *
 * @see {@link types/chat/chat.ts} for the enriched Chat type with messages
 * @see {@link types/message/message-row.ts} for individual message rows
 * @author Maruf Bepary
 */
export type ChatRow = InferSelectModel<typeof chat>;
