import { DEFERRED_APP_TOOL_NAMES, INTERNAL_TOOL_IDS } from "@/config/tools";

/**
 * Filter tools to guarantee the 2-layer architectural boundary:
 * 1. `delegate_task` is strictly omitted to prevent subagents from calling subagents.
 * 2. `manage_artifact` is strictly omitted to protect the user canvas from partial worker drafts.
 * 3. App self-knowledge and workspace mutation/inspection tools are strictly omitted.
 *
 * @param availableTools - Target available tools
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function getSubagentTools(
  availableTools: Record<string, any>,
): Record<string, any> {
  const forbidden = new Set<string>([
    "delegate_task",
    INTERNAL_TOOL_IDS.DELEGATE_TASK,
    "manage_artifact",
    INTERNAL_TOOL_IDS.MANAGE_ARTIFACT,
    "create_skill",
    "update_skill",
    "write_skill_file",
    "delete_skill_file",
    INTERNAL_TOOL_IDS.MANAGE_SKILL,
    INTERNAL_TOOL_IDS.APP_TOOLS,
    "app_help",
    "search_app_tools",
    ...DEFERRED_APP_TOOL_NAMES,
  ]);

  const sanitized: Record<string, any> = {};
  for (const [name, toolInstance] of Object.entries(availableTools)) {
    if (!forbidden.has(name)) {
      sanitized[name] = toolInstance;
    }
  }
  return sanitized;
}
