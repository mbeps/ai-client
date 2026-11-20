import { z } from "zod";
import {
  BUILT_IN_AGENT_IDS,
  LINKABLE_BUILT_IN_AGENT_IDS,
} from "@/config/built-in-agents";
import { promptIdsSchema, promptModeSchema } from "@/schemas/prompt/prompt";
import {
  contentField,
  dateField,
  descriptionField,
  idField,
  nameField,
  renameSchema,
} from "@/schemas/shared-fields";
import { skillIdsSchema, skillModeSchema } from "@/schemas/skill/skill-config";

/**
 * Accepts either a custom agent UUID or any built-in system agent ID.
 */
export const agentIdOrBuiltInField = z.union([
  idField,
  z.enum(BUILT_IN_AGENT_IDS),
]);

/**
 * Accepts either a custom agent UUID or a linkable built-in subagent ID (excludes `builtin:kb-reader`).
 */
export const subagentTargetIdField = z.union([
  idField,
  z.enum(LINKABLE_BUILT_IN_AGENT_IDS),
]);

/**
 * Validates execution guardrails for a delegated Layer-2 subagent run.
 */
export const agentGuardrailsSchema = z.object({
  maxSteps: z.number().int().min(1).max(30).default(10),
  scratchpadAccess: z
    .enum(["read_write", "read_only", "none"])
    .default("read_write"),
  isolateTools: z.boolean().default(true),
});

/**
 * Validates creation of a new unified Agent.
 */
export const createAgentSchema = z.object({
  name: nameField,
  description: descriptionField,
  prompt: contentField.optional(),
  subagentPrompt: contentField.optional(),
  modelId: z.string().max(100).nullable().optional(),
  knowledgebaseIds: z.array(idField).optional(),
  tools: z.array(z.string()).optional(),
  skillMode: skillModeSchema.optional(),
  skillIds: skillIdsSchema.optional(),
  promptMode: promptModeSchema.optional(),
  promptIds: promptIdsSchema.optional(),
  subagentIds: z.array(subagentTargetIdField).optional(),
  guardrails: agentGuardrailsSchema.optional(),
  avatar: z.string().url().max(1024).optional().nullable(),
});

/**
 * Validates partial updates to an existing custom Agent without re-applying inner `.default()` values.
 */
export const updateAgentSchema = createAgentSchema
  .omit({
    skillMode: true,
    skillIds: true,
    promptMode: true,
    promptIds: true,
    guardrails: true,
  })
  .partial()
  .extend({
    skillMode: z.enum(["dynamic", "none", "specific"]).optional(),
    skillIds: z.array(z.string()).optional(),
    promptMode: z.enum(["all", "none", "specific"]).optional(),
    promptIds: z.array(z.string()).optional(),
    guardrails: agentGuardrailsSchema.optional(),
  });

/**
 * Validates renaming an Agent.
 */
export const renameAgentSchema = renameSchema;

/**
 * Validates deleting a custom Agent by UUID.
 */
export const deleteAgentSchema = z.object({
  id: idField,
});

/**
 * Validates the full persisted Agent entity shape.
 */
export const agentEntitySchema = z.object({
  id: agentIdOrBuiltInField,
  userId: z.string(),
  name: nameField,
  description: z.string(),
  prompt: z.string(),
  subagentPrompt: z.string(),
  modelId: z.string().nullable(),
  knowledgebaseIds: z.array(z.string()),
  tools: z.array(z.string()),
  skillMode: skillModeSchema,
  skillIds: skillIdsSchema,
  promptMode: promptModeSchema,
  promptIds: promptIdsSchema,
  subagentIds: z.array(subagentTargetIdField),
  guardrails: agentGuardrailsSchema,
  avatar: z.string().url().max(1024).nullable().optional(),
  createdAt: dateField,
  updatedAt: dateField,
});
