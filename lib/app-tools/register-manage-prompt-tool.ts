import { tool } from "ai";
import { z } from "zod";
import { ROUTES } from "@/config/routes";
import { toToolFailure } from "@/lib/app-tools/format-service-error";
import {
  createPromptForUser,
  updatePromptForUser,
} from "@/lib/prompts/prompt-service";

const promptFieldsSchema = {
  title: z.string().min(1).max(100),
  shortcut: z.string().min(1).max(50),
  content: z.string().min(1).max(50_000),
  projectIds: z.array(z.string().uuid()).optional(),
  agentIds: z.array(z.string().uuid()).optional(),
};

const managePromptInputSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("create"),
    ...promptFieldsSchema,
  }),
  z.object({
    action: z.literal("update"),
    id: z.string().uuid().describe("UUID of the prompt to update."),
    title: promptFieldsSchema.title.optional(),
    shortcut: promptFieldsSchema.shortcut.optional(),
    content: promptFieldsSchema.content.optional(),
    projectIds: promptFieldsSchema.projectIds,
    agentIds: promptFieldsSchema.agentIds,
  }),
]);

/**
 * Registers the deferred `manage_prompt` tool for creating and updating prompt shortcuts.
 */
export function registerManagePromptTool(
  userId: string,
  options?: { deferLoading?: boolean },
) {
  return {
    manage_prompt: tool({
      deferLoading: options?.deferLoading ?? true,
      description:
        "Creates or updates a reusable slash-command Prompt shortcut owned by the user.",
      inputSchema: managePromptInputSchema,
      execute: async (input) => {
        if (input.action === "create") {
          const { action: _, ...data } = input;
          const res = await createPromptForUser(userId, data);
          if (!res.ok) return toToolFailure(res.error);
          return {
            success: true as const,
            action: "create" as const,
            id: res.value.id,
            title: res.value.title,
            shortcut: res.value.shortcut,
            route: ROUTES.PROMPTS.detail(res.value.id),
          };
        }

        const { action: _, id, ...data } = input;
        const res = await updatePromptForUser(userId, id, data);
        if (!res.ok) return toToolFailure(res.error);
        return {
          success: true as const,
          action: "update" as const,
          id: res.value.id,
          title: res.value.title,
          shortcut: res.value.shortcut,
          route: ROUTES.PROMPTS.detail(res.value.id),
        };
      },
    }),
  };
}
