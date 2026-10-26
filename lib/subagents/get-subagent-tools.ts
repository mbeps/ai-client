import { INTERNAL_TOOL_IDS } from "@/config/tools";

/**
 * Filter tools to guarantee the 2-layer architectural boundary:
 * 1. `delegate_task` is strictly omitted to prevent subagents from calling subagents.
 * 2. `manage_artifact` is strictly omitted to protect the user canvas from partial worker drafts.
 */
export function getSubagentTools(
  availableTools: Record<string, any>,
): Record<string, any> {
  const forbidden = new Set([
    "delegate_task",
    "subagent_dispatch",
    "manage_artifact",
    INTERNAL_TOOL_IDS.MANAGE_ARTIFACT,
  ]);

  const sanitized: Record<string, any> = {};
  for (const [name, toolInstance] of Object.entries(availableTools)) {
    if (!forbidden.has(name)) {
      sanitized[name] = toolInstance;
    }
  }
  return sanitized;
}
