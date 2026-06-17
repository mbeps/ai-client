import { z } from "zod";
import { promptSchema } from "@/schemas/prompt";

/**
 * Represents a reusable prompt snippet accessible via slash-commands in the chat input.
 * Prompts enable power users to quickly insert predefined content (system instructions,
 * code templates, checklists, etc.) using the shortcut syntax /shortcut-name.
 * Shortcuts are hidden from the final AI request but prepend content before sending.
 *
 * @author Maruf Bepary
 */
export type Prompt = z.infer<typeof promptSchema>;
