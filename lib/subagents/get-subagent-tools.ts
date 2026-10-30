import { INTERNAL_TOOL_IDS } from "@/config/tools";

/**
 * Filter tools to guarantee the 2-layer architectural boundary:
 * 1. `delegate_task` is strictly omitted to prevent subagents from calling subagents.
 * 2. `manage_artifact` is strictly omitted to protect the user canvas from partial worker drafts.
 * 3. Skill authoring/mutation tools are strictly omitted to prevent subagents from mutating user skills.
 *
 * @param availableTools - Target available tools
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function getSubagentTools(
  availableTools: Record<string, any>,
): Record<string, any> {
  const forbidden = new Set([
    "delegate_task",
    "subagent_dispatch",
    "manage_artifact",
    INTERNAL_TOOL_IDS.MANAGE_ARTIFACT,
    "create_skill",
    "update_skill",
    "write_skill_file",
    "delete_skill_file",
    INTERNAL_TOOL_IDS.MANAGE_SKILL,
  ]);

  const sanitized: Record<string, any> = {};
  for (const [name, toolInstance] of Object.entries(availableTools)) {
    if (!forbidden.has(name)) {
      sanitized[name] = toolInstance;
    }
  }
  return sanitized;
}
