import type { Agent } from "@/types/agent/agent";

/**
 * Formats the linked subagents into a markdown manifest for the orchestrator's system prompt.
 *
 * @param subagents - Linked leaf or built-in agents available for delegation
 * @returns Formatted markdown section, or empty string when no subagents are available
 * @author Maruf Bepary
 */
export function formatSubagentManifest(subagents: readonly Agent[]): string {
  if (subagents.length === 0) {
    return "";
  }

  const lines = subagents.map((agent) => {
    const desc = agent.description?.trim() || "General-purpose subagent.";
    return `- **${agent.name}** (\`${agent.id}\`): ${desc}`;
  });

  return [
    "## Available Subagents",
    "You can delegate self-contained tasks to the following subagents using the `delegate_task` tool. Pass the target agent's ID (or name/role) in `agent`, a self-contained `taskBrief`, and optional `inputData`:",
    "",
    ...lines,
  ].join("\n");
}
