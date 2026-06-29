import { type InferSelectModel } from "drizzle-orm";
import { assistant } from "@/drizzle/schema";

/**
 * Database representation of an AI assistant persona from the Drizzle schema.
 * System prompt prepends to AI calls for chats bound to this assistant.
 * Avatar URL enables visual identification in chat UI.
 * Enables creation and reuse of chat personalities across multiple conversations.
 *
 * @see {@link types/assistant/assistant.ts} for enriched Assistant type
 * @see {@link types/chat/chat-row.ts} for chats that reference this assistant
 * @author Maruf Bepary
 */
export type AssistantRow = InferSelectModel<typeof assistant>;
