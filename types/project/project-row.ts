import { type InferSelectModel } from "drizzle-orm";
import { project } from "@/drizzle/schema";

/**
 * Database representation of a user project (chat group with shared system prompt) from the Drizzle schema.
 * Global prompt prepends to AI calls for chats scoped to this project.
 * isPinned controls whether project appears in pinned section of sidebar for quick access.
 *
 * @see {@link types/project/project.ts} for enriched Project type
 * @see {@link types/chat/chat-row.ts} for chats in this project
 * @author Maruf Bepary
 */
export type ProjectRow = InferSelectModel<typeof project>;
