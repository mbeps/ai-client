import { z } from "zod";
import { assistantSchema } from "@/schemas/assistant/assistant";

/**
 * Detailed representation of an AI persona or specialized bot.
 * Contains system prompt, tools, and optional avatar for conversation personalization.
 * Derived from Zod schema for validation and type safety.
 * Assistants enable creation of reusable chat personalities with consistent instructions.
 *
 * @see {@link schemas/assistant/assistant.ts} for creation/update validation
 * @see {@link types/assistant/assistant-row.ts} for database representation
 * @author Maruf Bepary
 */
export type Assistant = z.infer<typeof assistantSchema>;
