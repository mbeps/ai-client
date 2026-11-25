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

const manageWorkflowInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    ...workflowFieldsSchema,
  }),
  z.object({
    action: z.literal("update"),
    id: z.string().uuid().describe("UUID of the workflow to update."),
    name: workflowFieldsSchema.name.optional(),
    description: workflowFieldsSchema.description,
    globalContext: workflowFieldsSchema.globalContext,
    modelId: workflowFieldsSchema.modelId,
    reasoningEffort: workflowFieldsSchema.reasoningEffort,
    tools: workflowFieldsSchema.tools,
    skillMode: workflowFieldsSchema.skillMode,
    skillIds: workflowFieldsSchema.skillIds,
    knowledgeBaseIds: workflowFieldsSchema.knowledgeBaseIds,
    subagentIds: workflowFieldsSchema.subagentIds,
    requiresFileUpload: workflowFieldsSchema.requiresFileUpload,
    canvasConfig: workflowFieldsSchema.canvasConfig,
    approvalConfig: workflowFieldsSchema.approvalConfig,
    nodes: workflowFieldsSchema.nodes,
    edges: workflowFieldsSchema.edges,
  }),
]);

/**
 * Registers the deferred `manage_workflow` tool for creating and updating DAG workflows.
 */
export function registerManageWorkflowTool(
  userId: string,
  options?: { deferLoading?: boolean },
) {
  return {
    manage_workflow: tool({
      deferLoading: options?.deferLoading ?? true,
      description:
        "Creates or updates a visual DAG Workflow owned by the user, including validated nodes and directed edges.",
      inputSchema: manageWorkflowInputSchema,
      execute: async (input) => {
        if (input.action === "create") {
          const { action: _, ...data } = input;
          const res = await createWorkflowForUser(userId, data);
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
        const res = await updateWorkflowForUser(userId, id, data);
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
