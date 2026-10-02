import type { z } from "zod";
import type { skillFileSchema, skillSchema } from "@/schemas/skill/skill";

export type SkillBundledFile = z.infer<typeof skillFileSchema>;

/**
 * Represents an Agent Skill adhering to the Open Agent Skills specification.
 * Skills provide modular, reusable domain knowledge and workflow procedures
 * that can be dynamically loaded by the AI model via progressive disclosure
 * or manually selected by the user via slash commands and UI pickers.
 *
 * @see {@link schemas/skill/skill.ts} for Zod schema validation
 * @author Maruf Bepary
 */
export type Skill = z.infer<typeof skillSchema>;

/**
 * Lightweight summary of an available skill used in system prompt catalogs.
 */
export interface SkillSummary {
  name: string;
  displayName: string;
  description: string;
}
