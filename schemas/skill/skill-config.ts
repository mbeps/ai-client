import { z } from "zod";

/**
 * Zod schema validating agent skill modes.
 * - dynamic: automatically load skills on demand via load_skill tool (default)
 * - none: disable skills completely
 * - specific: pre-load designated skills into prompt and retain dynamic access to others
 */
export const skillModeSchema = z
  .enum(["dynamic", "none", "specific"])
  .default("dynamic");

/**
 * Zod schema validating array of skill IDs.
 */
export const skillIdsSchema = z.array(z.string()).default([]);

export type SkillMode = z.infer<typeof skillModeSchema>;
