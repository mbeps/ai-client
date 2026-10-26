import { z } from "zod";
import {
  descriptionField,
  nameField,
  renameSchema,
} from "@/schemas/shared-fields";
import { skillIdsSchema, skillModeSchema } from "@/schemas/skill/skill-config";

/**
 * Validates renaming input for a transformation agent.
 *
 * @author Maruf Bepary
 */
export const renameTransformAgentSchema = renameSchema;

/**
 * Validates a single transformation step in a multi-step workflow.
 * Each step includes a name, prompt, MCP server IDs (for tool selection), and tool IDs.
 * Order field determines execution sequence; requiresReview flag indicates manual approval needed.
 * Prompts capped at 4,000 chars for efficient token usage.
 *
 * @author Maruf Bepary
 */
export const transformStepSchema = z.object({
  id: z.string().min(1),
  name: nameField,
  prompt: z.string().max(4000),
  mcpServerIds: z.array(z.string()),
  toolIds: z.array(z.string()),
  order: z.number().int().min(0),
  requiresReview: z.boolean(),
});

/**
 * Inferred type representation of a transformation step definition.
 *
 * @author Maruf Bepary
 */
export type TransformStepInput = z.infer<typeof transformStepSchema>;

/**
 * Validates creation of a multi-step transformation agent workflow.
 *
 * @author Maruf Bepary
 */
export const createTransformAgentSchema = z.object({
  name: nameField,
  description: descriptionField,
  globalContext: z.string().max(2000).optional(),
  modelId: z.string().max(100).optional(),
  tools: z.array(z.string()).optional().default([]),
  skillMode: skillModeSchema.optional(),
  skillIds: skillIdsSchema.optional(),
  knowledgeBaseIds: z.array(z.string()).optional().default([]),
  requiresFileUpload: z.boolean().optional().default(true),
  steps: z.array(transformStepSchema).optional().default([]),
});

/**
 * Validates partial updates to an existing transformation agent workflow definition.
 *
 * @author Maruf Bepary
 */
export const updateTransformAgentSchema = createTransformAgentSchema
  .omit({
    tools: true,
    skillMode: true,
    skillIds: true,
    knowledgeBaseIds: true,
    requiresFileUpload: true,
    steps: true,
  })
  .partial()
  .extend({
    tools: z.array(z.string()).optional(),
    // Not `skillModeSchema.optional()`: in Zod v4 an `.optional()` wrapper still
    // applies the inner `.default()`, so a partial update would silently reset
    // the agent's skill configuration.
    skillMode: z.enum(["dynamic", "none", "specific"]).optional(),
    skillIds: z.array(z.string()).optional(),
    knowledgeBaseIds: z.array(z.string()).optional(),
    requiresFileUpload: z.boolean().optional(),
    steps: z.array(transformStepSchema).optional(),
  });

/**
 * Validates partial transform agent updates allowing selective field modification.
 * All fields optional to enable independent updates.
 * Omitted fields preserve existing values.
 * Use with updateTransformAgent server action to modify existing workflow definitions.
 *
 * @author Maruf Bepary
 */
export const createTransformRunSchema = z.object({
  agentId: z.string().uuid(),
  inputAttachmentIds: z
    .union([z.array(z.string().uuid()), z.string()])
    .optional()
    .default([]),
  dryRun: z.boolean().optional().default(false),
  model: z.string().max(100).optional(),
});
