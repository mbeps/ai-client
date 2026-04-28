import { type InferSelectModel } from "drizzle-orm";
import { assistant } from "../drizzle/schema";

/**
 * Database representation of an AI assistant persona (with system prompt and avatar) from the drizzle schema.
 * prompt is prepended to AI calls for chats bound to this assistant; enables creation of reusable chat personalities.
 *
 * @see {@link ../drizzle/schemas/assistant-schema.ts} for database definition
 * @author Maruf Bepary
 */
export type AssistantRow = InferSelectModel<typeof assistant>;
