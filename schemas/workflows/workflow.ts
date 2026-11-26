import { z } from "zod";
import {
  agentIdOrBuiltInField,
  subagentTargetIdField,
} from "@/schemas/agent/agent";
import { reasoningEffortSchema } from "@/schemas/providers/provider-registry";
import {
  descriptionField,
  nameField,
  renameSchema,
} from "@/schemas/shared-fields";
import { skillIdsSchema, skillModeSchema } from "@/schemas/skill/skill-config";
import {
  DEFAULT_WORKFLOW_APPROVAL_CONFIG,
  DEFAULT_WORKFLOW_CANVAS_CONFIG,
  RESERVED_STRUCTURED_OUTPUT_FIELDS,
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
const artifactCanvasTypeSchema = z.enum([
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
const ifConditionOperatorSchema = z.enum([
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
const ifConditionRuleSchema = z.object({
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
  secretHeaderName: z
    .string()
    .trim()
    .max(100)
    .regex(
      /^[!#$%&'*+.^_`|~0-9A-Za-z-]*$/,
      "Header name must contain only HTTP token characters",
    )
    .optional(),
  samplePayload: z.string().max(20000).optional(),
});

const outputFieldNameSchema = z
  .string()
  .trim()
  .min(1, "Field name is required")
  .max(64, "Field name must be 64 characters or fewer")
  .regex(
    /^[A-Za-z_][A-Za-z0-9_]*$/,
    "Field name must start with a letter or underscore and contain only letters, digits, and underscores",
  )
  .refine(
    (name) => !RESERVED_STRUCTURED_OUTPUT_FIELDS.has(name),
    "Field name is reserved (cannot be text, data, artifact, or outputAttachmentId)",
  );

const structuredOutputSubfieldSchema = z.object({
  id: z.string().min(1),
  name: outputFieldNameSchema,
  type: z.enum(["string", "number", "boolean"]),
  description: z.string().max(300).optional(),
  required: z.boolean(),
});

/**
 * Zod schema validating a single top-level structured output field.
 */
export const structuredOutputFieldSchema = z
  .object({
    id: z.string().min(1),
    name: outputFieldNameSchema,
    type: z.enum([
      "string",
      "number",
      "boolean",
      "string_array",
      "number_array",
      "object_array",
    ]),
    description: z.string().max(300).optional(),
    required: z.boolean(),
    itemFields: z
      .array(structuredOutputSubfieldSchema)
      .max(15, "At most 15 item subfields are allowed")
      .optional(),
  })
  .superRefine((field, ctx) => {
    if (field.type !== "object_array") return;
    if (!field.itemFields || field.itemFields.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "List of Objects requires at least one item subfield",
        path: ["itemFields"],
      });
      return;
    }
    const seen = new Set<string>();
    for (const sub of field.itemFields) {
      if (seen.has(sub.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate subfield name "${sub.name}"`,
          path: ["itemFields"],
        });
      }
      seen.add(sub.name);
    }
  });

/**
 * Zod schema validating the structured output definition on an AI Step node.
 */
export const structuredOutputSchema = z
  .object({
    fields: z
      .array(structuredOutputFieldSchema)
      .max(30, "At most 30 structured output fields are allowed"),
  })
  .superRefine((schema, ctx) => {
    const seen = new Set<string>();
    for (const field of schema.fields) {
      if (seen.has(field.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `Duplicate field name "${field.name}"`,
          path: ["fields"],
        });
      }
      seen.add(field.name);
    }
  });

const aiStepNodeDataSchema = z.object({
  kind: z.literal("ai_step"),
  variableName: variableNameField,
  agentId: agentIdOrBuiltInField.optional(),
  prompt: z.string().max(8000),
  modelId: z.string().max(100).optional(),
  reasoningEffort: reasoningEffortSchema.optional(),
  mcpServerIds: z.array(z.string()),
  toolIds: z.array(z.string()),
  knowledgeBaseIds: z.array(z.string()).optional(),
  skillMode: z.enum(["inherit", "dynamic", "none", "specific"]).optional(),
  skillIds: z.array(z.string()).optional(),
  subagentIds: z.array(subagentTargetIdField).optional(),
  requiresReview: z.boolean(),
  reviewTiming: z.enum(["before", "after"]).optional(),
  toolApprovalMode: z.enum(["inherit", "auto", "ask"]).optional(),
  canvasMode: z
    .union([z.enum(["inherit", "disabled", "any"]), artifactCanvasTypeSchema])
    .optional(),
  outputMode: z.enum(["text", "structured", "canvas"]).optional(),
  structuredOutputSchema: structuredOutputSchema.optional(),
});

const ifConditionNodeDataSchema = z.object({
  kind: z.literal("if_condition"),
  variableName: variableNameField,
  evaluationMode: z.enum(["deterministic", "llm", "hybrid"]),
  logic: z.enum(["and", "or"]),
  rules: z.array(ifConditionRuleSchema),
  llmConditionPrompt: z.string().max(4000).optional(),
  modelId: z.string().max(100).optional(),
  reasoningEffort: reasoningEffortSchema.optional(),
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

const filterNodeDataSchema = z.object({
  kind: z.literal("filter"),
  variableName: variableNameField,
  itemsTemplate: z.string().max(2000),
  evaluationMode: z.enum(["deterministic", "llm"]),
  logic: z.enum(["and", "or"]),
  rules: z.array(ifConditionRuleSchema),
  llmFilterPrompt: z.string().max(4000).optional(),
  modelId: z.string().max(100).optional(),
  reasoningEffort: reasoningEffortSchema.optional(),
  continueWhenEmpty: z.boolean().optional(),
});

const loopNodeDataSchema = z.object({
  kind: z.literal("loop"),
  variableName: variableNameField,
  mode: z.enum(["for_each", "count"]),
  itemsTemplate: z.string().max(2000).optional(),
  count: z.number().int().min(1).max(50).optional(),
  maxIterations: z.number().int().min(1).max(50).default(20),
});

/**
 * Discriminated union schema for all 7 workflow node payloads.
 */
const workflowNodeDataSchema = z.discriminatedUnion("kind", [
  manualTriggerNodeDataSchema,
  webhookTriggerNodeDataSchema,
  aiStepNodeDataSchema,
  ifConditionNodeDataSchema,
  httpRequestNodeDataSchema,
  filterNodeDataSchema,
  loopNodeDataSchema,
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
      "loop",
      "filter",
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
  reasoningEffort: reasoningEffortSchema.nullable().optional(),
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
    if (data.edges !== undefined && data.nodes === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["edges"],
        message: "Edges cannot be updated without providing nodes",
      });
    }
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
  gateId: z.string().min(1).optional(),
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
