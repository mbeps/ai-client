import { z } from "zod";
import { dateField, idField, nameField } from "@/schemas/shared-fields";
import { skillFilePathSchema } from "@/schemas/skill/skill-file";

/**
 * Maximum character length allowed for skill descriptions across schemas and database records.
 *
 * @author Maruf Bepary
 */
export const SKILL_DESCRIPTION_MAX_LENGTH = 500;

/**
 * Validates a skill slug/identifier conforming to lowercase alphanumeric and hyphen format.
 *
 * @author Maruf Bepary
 */
export const skillSlugSchema = z
  .string()
  .min(1, "Skill name/slug is required")
  .max(64, "Skill name must be at most 64 characters")
  .regex(
    /^[a-z0-9-]+$/,
    "Skill name must contain only lowercase alphanumeric characters and hyphens",
  );

const skillDescriptionSchema = z
  .string()
  .min(1, "Description is required")
  .max(
    SKILL_DESCRIPTION_MAX_LENGTH,
    `Description must be at most ${SKILL_DESCRIPTION_MAX_LENGTH} characters`,
  );

/**
 * Validates an individual bundled file within an agent skill directory structure.
 *
 * @author Maruf Bepary
 */
export const skillFileSchema = z.object({
  path: skillFilePathSchema,
  content: z.string(),
});

const baseSkillFields = {
  name: skillSlugSchema,
  displayName: nameField,
  description: skillDescriptionSchema,
  content: z.string().min(1, "Instructions content (SKILL.md) is required"),
  files: z.array(skillFileSchema).default([]),
  enabled: z.boolean().default(true),
  projectId: z.string().nullable().optional(),
  assistantId: z.string().nullable().optional(),
};

/**
 * Validates new Agent Skill creation.
 * Follows Open Agent Skills specification requirements.
 * Optional projectId or assistantId scopes the skill to a specific entity; mutual exclusion enforced.
 *
 * @author Maruf Bepary
 */
export const createSkillSchema = z
  .object(baseSkillFields)
  .refine((data) => !(data.projectId && data.assistantId), {
    message: "A skill cannot be scoped to both a project and an assistant",
    path: ["assistantId"],
  });

/**
 * Validates partial skill updates.
 * Optional projectId or assistantId scopes the skill to a specific entity; mutual exclusion enforced.
 *
 * @author Maruf Bepary
 */
export const updateSkillSchema = z
  .object(baseSkillFields)
  .omit({ files: true, enabled: true })
  .partial()
  .extend({
    files: z.array(skillFileSchema).optional(),
    enabled: z.boolean().optional(),
  })
  .refine((data) => !(data.projectId && data.assistantId), {
    message: "A skill cannot be scoped to both a project and an assistant",
    path: ["assistantId"],
  });

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
  description: z.string().min(1).max(SKILL_DESCRIPTION_MAX_LENGTH),
  content: z.string().min(1),
  files: z.array(skillFileSchema).default([]),
  enabled: z.boolean().default(true),
  projectId: z.string().nullable().optional(),
  assistantId: z.string().nullable().optional(),
  createdAt: dateField,
  updatedAt: dateField,
});

/**
 * Input payload shape for creating a new custom agent skill.
 *
 * @author Maruf Bepary
 */
export type CreateSkillInput = z.infer<typeof createSkillSchema>;

/**
 * Input payload shape for updating an existing agent skill.
 *
 * @author Maruf Bepary
 */
export type UpdateSkillInput = z.infer<typeof updateSkillSchema>;
