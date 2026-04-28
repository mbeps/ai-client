import { type InferSelectModel } from "drizzle-orm";
import { message } from "../drizzle/schema";

/**
 * Database representation of a message in a branching conversation tree from the drizzle schema.
 * Supports tree structure via parentId; metadata stores JSON-serialized tool calls and reasoning tokens.
 *
 * @see {@link ../drizzle/schemas/chat-schema.ts} for database definition
 * @author Maruf Bepary
 */
export type MessageRow = InferSelectModel<typeof message>;
