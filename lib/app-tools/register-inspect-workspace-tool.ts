import { tool } from "ai";
import { z } from "zod";
import {
  getWorkspaceResource,
  INSPECTABLE_RESOURCES,
  listWorkspaceResource,
} from "@/lib/app-tools/inspect-workspace-queries";

const resourceSchema = z.enum(INSPECTABLE_RESOURCES);

const inspectWorkspaceInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("list"),
    resource: resourceSchema.describe("Workspace resource type to list."),
    limit: z
      .number()
      .int()
      .min(1)
      .max(100)
      .optional()
      .describe("Maximum items to return (default 50, max 100)."),
  }),
  z.object({
    action: z.literal("get"),
    resource: resourceSchema.describe("Workspace resource type to inspect."),
    identifier: z
      .string()
      .min(1)
      .describe(
        "Resource UUID (or slug for skills, or builtin:* ID for built-in agents).",
      ),
    filePath: z
      .string()
      .optional()
      .describe(
        "For skills only: relative file path inside the skill to read.",
      ),
  }),
]);

/**
 * Registers the deferred `inspect_workspace` read-only lookup tool.
 *
 * @param userId - Authenticated owner user ID
 * @param options - Optional deferral override (defaults to `deferLoading: true`)
 * @returns Tool map containing `inspect_workspace`
 */
export function registerInspectWorkspaceTool(
  userId: string,
  options?: { deferLoading?: boolean },
) {
  return {
    inspect_workspace: tool({
      deferLoading: options?.deferLoading ?? true,
      description:
        "Lists or inspects the user's workspace resources (skills, projects, agents, prompts, workflows, memories, models, knowledgebases, connectors) without exposing secrets.",
      inputSchema: inspectWorkspaceInputSchema,
      execute: async (input) => {
        if (input.action === "list") {
          const items = await listWorkspaceResource(
            userId,
            input.resource,
            input.limit,
          );
          return {
            success: true as const,
            action: "list" as const,
            resource: input.resource,
            items,
            count: items.length,
          };
        }

        const item = await getWorkspaceResource(
          userId,
          input.resource,
          input.identifier,
          input.filePath,
        );
        if (!item) {
          return {
            success: false as const,
            error: `${input.resource} "${input.identifier}" not found.`,
          };
        }
        return {
          success: true as const,
          action: "get" as const,
          resource: input.resource,
          item,
        };
      },
    }),
  };
}
