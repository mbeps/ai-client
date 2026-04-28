import { type InferSelectModel } from "drizzle-orm";
import { chat } from "../drizzle/schema";

/**
 * Database representation of a chat session from the drizzle schema.
 * Includes metadata for message tree tracking via currentLeafId and optional associations with projects and assistants.
 *
 * @see {@link ../drizzle/schemas/chat-schema.ts} for database definition
 * @author Maruf Bepary
 */
export type ChatRow = InferSelectModel<typeof chat>;
