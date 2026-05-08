import { z } from "zod";
import { nameField, descriptionField } from "./shared-fields";

export const transformStepSchema = z.object({
  id: z.string().uuid(),
  name: nameField,
  prompt: z.string().min(1, "Prompt is required").max(4000),
  context: z.string().max(2000).optional(),
  mcpServerIds: z.array(z.string()),
  toolIds: z.array(z.string()),
  order: z.number().int().min(0),
  requiresReview: z.boolean(),
});

export type TransformStepInput = z.infer<typeof transformStepSchema>;

export const createTransformAgentSchema = z.object({
  name: nameField,
  description: descriptionField,
  modelId: z.string().max(100).optional(),
  steps: z.array(transformStepSchema).optional().default([]),
});

export const updateTransformAgentSchema = z.object({
  name: nameField.optional(),
  description: descriptionField,
  modelId: z.string().max(100).optional(),
  steps: z.array(transformStepSchema).optional(),
});

export const createTransformRunSchema = z.object({
  agentId: z.string().uuid(),
  inputAttachmentIds: z
    .array(z.string().uuid())
    .min(1, "At least one input file is required"),
  dryRun: z.boolean().optional().default(false),
  model: z.string().max(100).optional(),
});

export const resumeTransformRunSchema = z.object({
  runId: z.string().uuid(),
});

export const startTransformRunSchema = z.object({
  runId: z.string().uuid(),
});
