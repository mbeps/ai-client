import { tool } from "ai";
import { z } from "zod";
import { resolveAppHelp } from "@/lib/app-tools/app-help-topics";

/**
 * Registers the lightweight always-loaded `app_help` tool so models can look
 * up accurate, route-verified app documentation on demand.
 *
 * @returns Tool map containing `app_help`
 */
export function registerAppHelpTool() {
  return {
    app_help: tool({
      description:
        "Returns accurate documentation, navigation routes, and configuration guides for features in this app " +
        "(connectors/MCP, providers/models, projects, agents, workflows, skills, prompts, knowledgebases, memory, tools, settings). " +
        "Call this whenever the user asks how to use, configure, or navigate the app.",
      inputSchema: z.object({
        topic: z
          .string()
          .optional()
          .describe(
            "Optional topic slug (e.g. 'connectors', 'providers', 'workflows', 'tools') or keyword query. Omit for an overview.",
          ),
      }),
      execute: async ({ topic }) => resolveAppHelp(topic),
    }),
  };
}
