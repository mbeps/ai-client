import { z } from "zod";
import { assistantSchema } from "@/schemas/assistant/assistant";

/**
 * Detailed representation of an AI persona or specialized bot.
 * Based on the Zod schema for validation and persistence.
 *
 * @see {@link schemas/assistant.ts}
 */
export type Assistant = z.infer<typeof assistantSchema>;
