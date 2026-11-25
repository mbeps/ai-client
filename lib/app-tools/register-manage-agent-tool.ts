import { tool } from "ai";
import { z } from "zod";
import { ROUTES } from "@/config/routes";
import {
  createAgentForUser,
  updateAgentForUser,
} from "@/lib/agents/agent-service";
import { toToolFailure } from "@/lib/app-tools/format-service-error";
import { agentGuardrailsSchema } from "@/schemas/agent/agent";
import { reasoningEffortSchema } from "@/schemas/providers/provider-registry";

const agentFieldsSchema = {
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  prompt: z.string().max(20_000).optional(),
  subagentPrompt: z.string().max(20_000).optional(),
  modelId: z.string().nullable().optional(),
  reasoningEffort: reasoningEffortSchema.nullable().optional(),
  knowledgebaseIds: z.array(z.string().uuid()).optional(),
  tools: z.array(z.string()).optional(),
  skillMode: z.enum(["dynamic", "none", "specific"]).optional(),
  skillIds: z.array(z.string()).optional(),
  promptMode: z.enum(["all", "none", "specific"]).optional(),
  promptIds: z.array(z.string()).optional(),
  subagentIds: z.array(z.string()).optional(),
  guardrails: agentGuardrailsSchema.optional(),
  avatar: z.string().url().nullable().optional(),
};

const manageAgentInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    ...agentFieldsSchema,
  }),
  z.object({
    action: z.literal("update"),
    id: z.string().min(1).describe("UUID of the custom agent to update."),
    name: agentFieldsSchema.name.optional(),
    description: agentFieldsSchema.description,
    prompt: agentFieldsSchema.prompt,
    subagentPrompt: agentFieldsSchema.subagentPrompt,
    modelId: agentFieldsSchema.modelId,
    reasoningEffort: agentFieldsSchema.reasoningEffort,
    knowledgebaseIds: agentFieldsSchema.knowledgebaseIds,
    tools: agentFieldsSchema.tools,
    skillMode: agentFieldsSchema.skillMode,
    skillIds: agentFieldsSchema.skillIds,
    promptMode: agentFieldsSchema.promptMode,
    promptIds: agentFieldsSchema.promptIds,
    subagentIds: agentFieldsSchema.subagentIds,
    guardrails: agentFieldsSchema.guardrails,
    avatar: agentFieldsSchema.avatar,
  }),
]);

/**
 * Registers the deferred `manage_agent` tool for creating and updating custom agents.
 */
export function registerManageAgentTool(
  userId: string,
  options?: { deferLoading?: boolean },
) {
  return {
    manage_agent: tool({
      deferLoading: options?.deferLoading ?? true,
      description:
        "Creates or updates a custom Agent owned by the user with prompt, model, tools, knowledge bases, guardrails, and subagent links.",
      inputSchema: manageAgentInputSchema,
      execute: async (input) => {
        if (input.action === "create") {
          const { action: _, ...data } = input;
          const res = await createAgentForUser(userId, data);
          if (!res.ok) return toToolFailure(res.error);
          return {
            success: true as const,
            action: "create" as const,
            id: res.value.id,
            name: res.value.name,
            route: ROUTES.AGENTS.detail(res.value.id),
          };
        }

        const { action: _, id, ...data } = input;
        const res = await updateAgentForUser(userId, id, data);
        if (!res.ok) return toToolFailure(res.error);
        return {
          success: true as const,
          action: "update" as const,
          id: res.value.id,
          name: res.value.name,
          route: ROUTES.AGENTS.detail(res.value.id),
        };
      },
    }),
  };
}
