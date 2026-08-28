import { z } from "zod";
import { idField, nameField, dateField } from "../shared-fields";

export const skillSlugSchema = z
  .string()
  .min(1, "Skill name/slug is required")
  .max(64, "Skill name must be at most 64 characters")
  .regex(
    /^[a-z0-9-]+$/,
    "Skill name must contain only lowercase alphanumeric characters and hyphens",
  );

export const skillFileSchema = z.object({
  path: z.string().min(1, "File path is required"),
  content: z.string(),
});

/**
 * Validates new Agent Skill creation.
 * Follows Open Agent Skills specification requirements.
 *
 * @author Maruf Bepary
 */
export const createSkillSchema = z.object({
  name: skillSlugSchema,
  displayName: nameField,
  description: z
    .string()
    .min(1, "Description is required")
    .max(1024, "Description must be at most 1024 characters"),
  content: z.string().min(1, "Instructions content (SKILL.md) is required"),
  files: z.array(skillFileSchema).default([]),
  enabled: z.boolean().default(true),
});

/**
 * Validates partial skill updates.
 *
 * @author Maruf Bepary
 */
export const updateSkillSchema = createSkillSchema.partial();

/**
 * Full Agent Skill schema as stored and serialized in the application.
 *
 * @author Maruf Bepary
 */
export const skillSchema = z.object({
  id: idField,
  userId: z.string(),
  name: skillSlugSchema,
  displayName: nameField,
  description: z.string().min(1).max(1024),
  content: z.string().min(1),
  files: z.array(skillFileSchema).default([]),
  enabled: z.boolean().default(true),
  createdAt: dateField,
  updatedAt: dateField,
});

export type CreateSkillInput = z.infer<typeof createSkillSchema>;
export type UpdateSkillInput = z.infer<typeof updateSkillSchema>;
