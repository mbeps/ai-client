import { z } from "zod";
import { nameField, descriptionField, renameSchema } from "../shared-fields";

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
  id: z.string().uuid(),
  name: nameField,
  prompt: z.string().min(1, "Prompt is required").max(4000),
  mcpServerIds: z.array(z.string()),
  toolIds: z.array(z.string()),
  order: z.number().int().min(0),
  requiresReview: z.boolean(),
});

export type TransformStepInput = z.infer<typeof transformStepSchema>;

/**
 * TypeScript type inferred from transformStepSchema for type-safe step handling.
 *
 * @author Maruf Bepary
 */
export const createTransformAgentSchema = z.object({
  name: nameField,
  description: descriptionField,
  globalContext: z.string().max(2000).optional(),
  modelId: z.string().max(100).optional(),
  tools: z.array(z.string()).optional().default([]),
  knowledgeBaseIds: z.array(z.string()).optional().default([]),
  requiresFileUpload: z.boolean().optional().default(true),
  steps: z.array(transformStepSchema).optional().default([]),
});

export const updateTransformAgentSchema = createTransformAgentSchema.partial();

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

export const resumeTransformRunSchema = z.object({
  runId: z.string().uuid(),
});

/**
 * Validates resumption of an interrupted transform run.
 * runId specifies which execution to resume from its current step.
 * Used when paused workflow execution needs to continue after review.
 *
 * @author Maruf Bepary
 */
export const startTransformRunSchema = z.object({
  runId: z.string().uuid(),
});
