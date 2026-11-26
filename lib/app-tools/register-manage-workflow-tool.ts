import { tool } from "ai";
import { z } from "zod";
import { ROUTES } from "@/config/routes";
import { toToolFailure } from "@/lib/app-tools/format-service-error";
import {
  createWorkflowForUser,
  updateWorkflowForUser,
} from "@/lib/workflows/workflow-service";
import { reasoningEffortSchema } from "@/schemas/providers/provider-registry";
import {
  workflowApprovalConfigSchema,
  workflowCanvasConfigSchema,
  workflowEdgeSchema,
  workflowNodeSchema,
} from "@/schemas/workflows/workflow";

const workflowFieldsSchema = {
  name: z.string().min(1).max(120),
  description: z.string().max(1000).optional(),
  globalContext: z.string().max(10_000).optional(),
  modelId: z.string().optional(),
  reasoningEffort: reasoningEffortSchema.nullable().optional(),
  tools: z.array(z.string()).optional(),
  skillMode: z.enum(["dynamic", "none", "specific"]).optional(),
  skillIds: z.array(z.string()).optional(),
  knowledgeBaseIds: z.array(z.string()).optional(),
  subagentIds: z.array(z.string()).optional(),
  requiresFileUpload: z.boolean().optional(),
  canvasConfig: workflowCanvasConfigSchema.optional(),
  approvalConfig: workflowApprovalConfigSchema.optional(),
  nodes: z.array(workflowNodeSchema).optional(),
  edges: z.array(workflowEdgeSchema).optional(),
};

const JSON_STRINGIFIED_FIELDS = [
  "nodes",
  "edges",
  "tools",
  "skillIds",
  "knowledgeBaseIds",
  "subagentIds",
  "canvasConfig",
  "approvalConfig",
] as const;

const TOP_LEVEL_NULLABLE_KEYS = new Set(["reasoningEffort"]);

function tryParseJson(value: unknown): unknown {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function stripNullOptionals(
  value: unknown,
  preserveNullKeys?: ReadonlySet<string>,
): unknown {
  if (Array.isArray(value)) {
    return value.map((item) => stripNullOptionals(item));
  }
  if (typeof value !== "object" || value === null) {
    return value;
  }
  const cleaned: Record<string, unknown> = {};
  for (const [key, entry] of Object.entries(value)) {
    if (entry === null) {
      if (preserveNullKeys?.has(key)) {
        cleaned[key] = null;
      }
      continue;
    }
    cleaned[key] = stripNullOptionals(entry);
  }
  return cleaned;
}

/**
 * Normalises raw tool-call arguments for `manage_workflow` before Zod validation.
 * Tolerates JSON-stringified payloads or array/object fields (e.g. `nodes`, `edges`)
 * and strips explicit `null` values on non-nullable optional fields so the advertised
 * JSON Schema stays a single flat object without top-level `anyOf`.
 */
function normaliseManageWorkflowInput(val: unknown): unknown {
  const target = tryParseJson(val);
  if (typeof target !== "object" || target === null || Array.isArray(target)) {
    return target;
  }
  const record: Record<string, unknown> = {
    ...(target as Record<string, unknown>),
  };
  for (const field of JSON_STRINGIFIED_FIELDS) {
    if (typeof record[field] === "string") {
      record[field] = tryParseJson(record[field]);
    }
  }
  return stripNullOptionals(record, TOP_LEVEL_NULLABLE_KEYS);
}

const manageWorkflowBaseSchema = z.object({
  action: z.enum(["create", "update"]),
  id: z
    .string()
    .uuid()
    .optional()
    .describe(
      "UUID of the workflow to update (required when action is 'update').",
    ),
  ...workflowFieldsSchema,
  name: workflowFieldsSchema.name
    .optional()
    .describe("Workflow name (required when action is 'create')."),
});

const manageWorkflowInputSchema = Object.assign(
  z.preprocess(
    normaliseManageWorkflowInput,
    manageWorkflowBaseSchema.superRefine((data, ctx) => {
      if (data.action === "create" && !data.name) {
        ctx.addIssue({
          code: "custom",
          path: ["name"],
          message: "Workflow name is required when action is 'create'",
        });
      }
      if (data.action === "update" && !data.id) {
        ctx.addIssue({
          code: "custom",
          path: ["id"],
          message: "Workflow id is required when action is 'update'",
        });
      }
    }),
  ),
  { shape: manageWorkflowBaseSchema.shape },
);

/**
 * Registers the deferred `manage_workflow` tool for creating and updating DAG workflows.
 */
export function registerManageWorkflowTool(
  userId: string,
  options?: { deferLoading?: boolean; lockedWorkflowId?: string },
) {
  return {
    manage_workflow: tool({
      deferLoading: options?.deferLoading ?? true,
      description:
        "Creates or updates a visual DAG Workflow owned by the user, including validated nodes and directed edges.",
      inputSchema: manageWorkflowInputSchema,
      execute: async (input) => {
        if (options?.lockedWorkflowId) {
          if (
            input.action === "create" ||
            input.id !== options.lockedWorkflowId
          ) {
            return {
              success: false as const,
              error:
                "This assistant can only edit the currently open workflow.",
            };
          }
        }

        if (input.action === "create") {
          const { action: _, ...data } = input;
          const res = await createWorkflowForUser(
            userId,
            data as Parameters<typeof createWorkflowForUser>[1],
          );
          if (!res.ok) return toToolFailure(res.error);
          return {
            success: true as const,
            action: "create" as const,
            id: res.value.id,
            name: res.value.name,
            route: ROUTES.WORKFLOWS.AUTOMATIONS.detail(res.value.id),
          };
        }

        const { action: _, id, ...data } = input;
        const res = await updateWorkflowForUser(userId, id as string, data);
        if (!res.ok) return toToolFailure(res.error);
        return {
          success: true as const,
          action: "update" as const,
          id: res.value.id,
          name: res.value.name,
          route: ROUTES.WORKFLOWS.AUTOMATIONS.detail(res.value.id),
        };
      },
    }),
  };
}
