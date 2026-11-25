import { tool } from "ai";
import { z } from "zod";
import { ROUTES } from "@/config/routes";
import { toToolFailure } from "@/lib/app-tools/format-service-error";
import {
  createProjectForUser,
  updateProjectForUser,
} from "@/lib/projects/project-service";

const projectFieldsSchema = {
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  globalPrompt: z.string().max(10_000).optional(),
  tools: z.array(z.string()).optional(),
  skillMode: z.enum(["dynamic", "none", "specific"]).optional(),
  skillIds: z.array(z.string()).optional(),
  promptMode: z.enum(["all", "none", "specific"]).optional(),
  promptIds: z.array(z.string()).optional(),
  subagentIds: z.array(z.string()).optional(),
  knowledgebaseId: z.string().uuid().nullable().optional(),
};

const manageProjectInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    ...projectFieldsSchema,
  }),
  z.object({
    action: z.literal("update"),
    id: z.string().uuid().describe("UUID of the project to update."),
    name: projectFieldsSchema.name.optional(),
    description: projectFieldsSchema.description,
    globalPrompt: projectFieldsSchema.globalPrompt,
    tools: projectFieldsSchema.tools,
    skillMode: projectFieldsSchema.skillMode,
    skillIds: projectFieldsSchema.skillIds,
    promptMode: projectFieldsSchema.promptMode,
    promptIds: projectFieldsSchema.promptIds,
    subagentIds: projectFieldsSchema.subagentIds,
    knowledgebaseId: projectFieldsSchema.knowledgebaseId,
  }),
]);

/**
 * Registers the deferred `manage_project` tool for creating and updating projects.
 */
export function registerManageProjectTool(
  userId: string,
  options?: { deferLoading?: boolean },
) {
  return {
    manage_project: tool({
      deferLoading: options?.deferLoading ?? true,
      description:
        "Creates or updates a Project owned by the user, including system prompt, tools, skills, knowledge base, and subagents.",
      inputSchema: manageProjectInputSchema,
      execute: async (input) => {
        if (input.action === "create") {
          const { action: _, ...data } = input;
          const res = await createProjectForUser(userId, data);
          if (!res.ok) return toToolFailure(res.error);
          return {
            success: true as const,
            action: "create" as const,
            id: res.value.id,
            name: res.value.name,
            route: ROUTES.PROJECTS.detail(res.value.id),
          };
        }

        const { action: _, id, ...data } = input;
        const res = await updateProjectForUser(userId, id, data);
        if (!res.ok) return toToolFailure(res.error);
        return {
          success: true as const,
          action: "update" as const,
          id: res.value.id,
          name: res.value.name,
          route: ROUTES.PROJECTS.detail(res.value.id),
        };
      },
    }),
  };
}
