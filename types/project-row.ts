import { type InferSelectModel } from "drizzle-orm";
import { project } from "../drizzle/schema";

/**
 * Database representation of a user project (chat group with shared system prompt) from the drizzle schema.
 * globalPrompt is prepended to AI calls for chats scoped to this project; isPinned controls UI visibility.
 *
 * @see {@link ../drizzle/schemas/project-schema.ts} for database definition
 * @author Maruf Bepary
 */
export type ProjectRow = InferSelectModel<typeof project>;
