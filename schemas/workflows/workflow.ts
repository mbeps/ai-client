import { z } from "zod";
import { subagentTargetIdField } from "@/schemas/agent/agent";
import {
  descriptionField,
  nameField,
  renameSchema,
} from "@/schemas/shared-fields";
import { skillIdsSchema, skillModeSchema } from "@/schemas/skill/skill-config";
import {
  DEFAULT_WORKFLOW_APPROVAL_CONFIG,
  DEFAULT_WORKFLOW_CANVAS_CONFIG,
} from "@/types/workflows/workflow";

/**
 * Valid JavaScript-like identifier used to reference node outputs via `{{variableName.path}}`.
 */
export const variableNameField = z
  .string()
  .trim()
  .min(1, "Variable name is required")
  .max(64, "Variable name must be 64 characters or less")
  .regex(/^[A-Za-z_$][A-Za-z0-9_$]*$/, "Must be a valid variable identifier");

/**
 * Supported Artifact Canvas output format types.
 */
export const artifactCanvasTypeSchema = z.enum([
  "markdown",
  "spreadsheet",
  "html",
  "mermaid",
]);

/** Workflow-level Artifact Canvas configuration schema. */
export const workflowCanvasConfigSchema = z.object({
  enabled: z.boolean(),
  allowedTypes: z.array(artifactCanvasTypeSchema),
  defaultType: z.union([artifactCanvasTypeSchema, z.literal("any")]).optional(),
  sharedCanvas: z.boolean().optional(),
});

/** Workflow-level approval and human review gate configuration schema. */
export const workflowApprovalConfigSchema = z.object({
  defaultReviewGate: z.enum(["none", "before", "after"]),
  toolApprovalMode: z.enum(["auto", "ask"]),
  autoApprovedTools: z.array(z.string()),
});

/**
 * Supported deterministic comparison operators for `If` condition rules.
 */
export const ifConditionOperatorSchema = z.enum([
  "equals",
  "not_equals",
  "contains",
  "not_contains",
  "starts_with",
  "ends_with",
  "regex",
  "gt",
  "lt",
  "is_empty",
  "is_not_empty",
]);

/**
 * Single deterministic rule evaluated inside an `if_condition` node.
 */
export const ifConditionRuleSchema = z.object({
  id: z.string().min(1),
  leftTemplate: z.string().max(1000),
  operator: ifConditionOperatorSchema,
  rightValue: z.string().max(1000).optional(),
});

const manualTriggerNodeDataSchema = z.object({
  kind: z.literal("manual_trigger"),
  variableName: variableNameField,
  requiresFileUpload: z.boolean().optional(),
});

const webhookTriggerNodeDataSchema = z.object({
  kind: z.literal("webhook_trigger"),
  variableName: variableNameField,
  secretHeaderName: z.string().max(100).optional(),
  samplePayload: z.string().max(20000).optional(),
});

const aiStepNodeDataSchema = z.object({
  kind: z.literal("ai_step"),
  variableName: variableNameField,
  prompt: z.string().max(8000),
  modelId: z.string().max(100).optional(),
  mcpServerIds: z.array(z.string()),
  toolIds: z.array(z.string()),
  requiresReview: z.boolean(),
  reviewTiming: z.enum(["before", "after"]).optional(),
  toolApprovalMode: z.enum(["inherit", "auto", "ask"]).optional(),
  canvasMode: z
    .union([z.enum(["inherit", "disabled", "any"]), artifactCanvasTypeSchema])
    .optional(),
});

const ifConditionNodeDataSchema = z.object({
  kind: z.literal("if_condition"),
  variableName: variableNameField,
  evaluationMode: z.enum(["deterministic", "llm", "hybrid"]),
  logic: z.enum(["and", "or"]),
  rules: z.array(ifConditionRuleSchema),
  llmConditionPrompt: z.string().max(4000).optional(),
  modelId: z.string().max(100).optional(),
});

const httpRequestNodeDataSchema = z.object({
  kind: z.literal("http_request"),
  variableName: variableNameField,
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE"]),
  url: z.string().max(2000),
  headers: z.array(
    z.object({
      key: z.string().max(200),
      value: z.string().max(2000),
    }),
  ),
  body: z.string().max(20000).optional(),
  timeoutMs: z.number().int().min(100).max(60000).optional(),
  requiresReview: z.boolean().optional(),
});

/**
 * Discriminated union schema for all 5 workflow node payloads.
 */
export const workflowNodeDataSchema = z.discriminatedUnion("kind", [
  manualTriggerNodeDataSchema,
  webhookTriggerNodeDataSchema,
  aiStepNodeDataSchema,
  ifConditionNodeDataSchema,
  httpRequestNodeDataSchema,
]);

/**
 * Schema for a single workflow graph node ensuring `type` matches `data.kind`.
 */
export const workflowNodeSchema = z
  .object({
    id: z.string().min(1),
    type: z.enum([
      "manual_trigger",
      "webhook_trigger",
      "ai_step",
      "if_condition",
      "http_request",
    ]),
    name: nameField,
    position: z.object({
      x: z.number(),
      y: z.number(),
    }),
    data: workflowNodeDataSchema,
  })
  .superRefine((node, ctx) => {
    if (node.type !== node.data.kind) {
      ctx.addIssue({
        code: "custom",
        path: ["data", "kind"],
        message: `Node data kind "${node.data.kind}" must match node type "${node.type}"`,
      });
    }
  });

/**
 * Schema for a directed edge connecting two workflow nodes.
 */
export const workflowEdgeSchema = z.object({
  id: z.string().min(1),
  sourceNodeId: z.string().min(1),
  targetNodeId: z.string().min(1),
  sourceHandle: z.string().min(1).default("main"),
  targetHandle: z.string().min(1).default("main"),
});

function validateUniqueVariableNames(
  nodes: Array<{ data: { variableName: string } }> | undefined,
  ctx: z.RefinementCtx,
) {
  if (!nodes) return;
  const seen = new Set<string>();
  for (let i = 0; i < nodes.length; i++) {
    const varName = nodes[i].data.variableName;
    if (seen.has(varName)) {
      ctx.addIssue({
        code: "custom",
        path: ["nodes", i, "data", "variableName"],
        message: `Duplicate variable name "${varName}" across workflow nodes`,
      });
    }
    seen.add(varName);
  }
}

const baseWorkflowSchema = z.object({
  name: nameField,
  description: descriptionField,
  globalContext: z.string().max(4000).optional(),
  modelId: z.string().max(100).optional(),
  tools: z.array(z.string()).optional().default([]),
  skillMode: skillModeSchema.optional(),
  skillIds: skillIdsSchema.optional(),
  knowledgeBaseIds: z.array(z.string()).optional().default([]),
  subagentIds: z.array(subagentTargetIdField).optional(),
  requiresFileUpload: z.boolean().optional().default(false),
  canvasConfig: workflowCanvasConfigSchema
    .optional()
    .default(DEFAULT_WORKFLOW_CANVAS_CONFIG),
  approvalConfig: workflowApprovalConfigSchema
    .optional()
    .default(DEFAULT_WORKFLOW_APPROVAL_CONFIG),
  nodes: z.array(workflowNodeSchema).optional(),
  edges: z.array(workflowEdgeSchema).optional(),
});

/**
 * Validates workflow creation payloads, ensuring unique `variableName` identifiers across nodes.
 */
export const createWorkflowSchema = baseWorkflowSchema.superRefine(
  (data, ctx) => {
    validateUniqueVariableNames(data.nodes, ctx);
  },
);

/**
 * Validates partial workflow updates without injecting inner `.default()` values on omitted fields.
 */
export const updateWorkflowSchema = baseWorkflowSchema
  .omit({
    tools: true,
    skillMode: true,
    skillIds: true,
    knowledgeBaseIds: true,
    subagentIds: true,
    requiresFileUpload: true,
    canvasConfig: true,
    approvalConfig: true,
    nodes: true,
    edges: true,
  })
  .partial()
  .extend({
    tools: z.array(z.string()).optional(),
    skillMode: z.enum(["dynamic", "none", "specific"]).optional(),
    skillIds: z.array(z.string()).optional(),
    knowledgeBaseIds: z.array(z.string()).optional(),
    subagentIds: z.array(subagentTargetIdField).optional(),
    requiresFileUpload: z.boolean().optional(),
    canvasConfig: workflowCanvasConfigSchema.optional(),
    approvalConfig: workflowApprovalConfigSchema.optional(),
    nodes: z.array(workflowNodeSchema).optional(),
    edges: z.array(workflowEdgeSchema).optional(),
  })
  .superRefine((data, ctx) => {
    validateUniqueVariableNames(data.nodes, ctx);
  });

/**
 * Validates workflow rename requests.
 */
export const renameWorkflowSchema = renameSchema;

/**
 * Validates manual workflow run creation payloads.
 */
export const createWorkflowRunSchema = z.object({
  workflowId: z.string().uuid(),
  inputAttachmentIds: z.array(z.string().uuid()).optional().default([]),
  dryRun: z.boolean().optional().default(false),
  model: z.string().max(100).optional(),
  initialData: z.record(z.string(), z.unknown()).optional(),
});

/**
 * Validates human review or tool approval submission payloads for a paused workflow run.
 */
export const approveWorkflowRunSchema = z.object({
  runId: z.string().uuid(),
  nodeId: z.string().min(1),
  approved: z.boolean(),
  feedback: z.string().max(2000).optional(),
  toolDecisions: z
    .array(
      z.object({
        approvalId: z.string().min(1),
        approved: z.boolean(),
      }),
    )
    .optional(),
});
