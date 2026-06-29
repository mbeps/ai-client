import { type InferSelectModel } from "drizzle-orm";
import { prompt } from "@/drizzle/schema";

/**
 * Database representation of a reusable prompt snippet from the Drizzle schema.
 * Includes all prompt metadata for persistence and retrieval.
 * Shortcut is unique per user for efficient command-based access.
 *
 * @see {@link types/prompt/prompt.ts} for enriched Prompt type
 * @author Maruf Bepary
 */
export type PromptRow = InferSelectModel<typeof prompt>;
