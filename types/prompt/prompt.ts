import { z } from "zod";
import { promptSchema } from "@/schemas/prompt/prompt";

/**
 * Represents a reusable prompt snippet accessible via slash-commands in the chat input.
 * Prompts enable power users to quickly insert predefined content (system instructions,
 * code templates, checklists, documentation standards, etc.) using /shortcut-name syntax.
 * Shortcuts are hidden from the final AI request but prepend content before sending.
 * Derived from Zod schema for validation and type safety.
 *
 * @see {@link schemas/prompt/prompt.ts} for creation/update validation
 * @see {@link types/prompt/prompt-row.ts} for database representation
 * @author Maruf Bepary
 */
export type Prompt = z.infer<typeof promptSchema>;
