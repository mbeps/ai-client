import type { ScratchpadAccessMode } from "@/drizzle/schemas/agent-schema";
import type { Agent } from "@/types/agent/agent";

/**
 * Metadata passed when constructing a Layer-2 delegated subagent system prompt.
 *
 * @author Maruf Bepary
 */
export interface SubagentExecutionMetadata {
  isSubagent: true;
  agentRole: string;
  agent?: Agent;
  parentInvocationId: string;
  runId: string;
  allocatedModel: string;
  scratchpadAccess?: ScratchpadAccessMode;
  scratchpadFiles?: string[];
  preloadedSkillInstructions?: string[];
}

function buildScratchpadGuideline(
  access: ScratchpadAccessMode,
  scratchpadFiles?: string[],
): string {
  if (access === "none") {
    return "";
  }
  const baseLine =
    access === "read_only"
      ? "4. You have read-only access to the shared scratchpad (scratchpad_read, scratchpad_list) to inspect peer outputs, but cannot write files."
      : "4. Use scratchpad_write to store intermediate findings, extensive document extracts, structured outlines, or tables for peer access and user inspection.";

  if (scratchpadFiles && scratchpadFiles.length > 0) {
    return `${baseLine}\n   Existing scratchpad files: ${scratchpadFiles.join(", ")}`;
  }
  return baseLine;
}

/**
 * Builds the system instructions for a Layer-2 delegated subagent, combining
 * identity constraints, custom agent prompts, scratchpad access rules,
 * preloaded skills, and the structured reporting contract.
 *
 * @param metadata - Subagent execution metadata and optional target Agent
 * @returns Complete subagent system prompt
 * @author Maruf Bepary
 */
export function constructSubagentPrompt(
  metadata: SubagentExecutionMetadata,
): string {
  const { agent, agentRole } = metadata;
  const effectiveScratchpadAccess: ScratchpadAccessMode =
    metadata.scratchpadAccess ??
    agent?.guardrails.scratchpadAccess ??
    "read_write";

  const roleHeader = agent
    ? `Role: ${agent.name} (${agent.id})`
    : `Role: ${agentRole.toUpperCase()}`;

  const scratchpadLine = buildScratchpadGuideline(
    effectiveScratchpadAccess,
    metadata.scratchpadFiles,
  );

  const sections: string[] = [
    [
      "[SYSTEM IDENTITY: ISOLATED WORKER SUBAGENT]",
      roleHeader,
      "Execution Mode: Layer 1 Worker",
      "Topological Constraints:",
      "1. You are operating as an isolated subagent under an orchestrating agent.",
      "2. You cannot spawn subordinate agents (depth limit d=1).",
      "3. You cannot manipulate the user's canvas or create artifacts directly.",
      scratchpadLine,
      "5. Conclude your work with a clear, self-contained summary adhering to your reporting contract.",
    ]
      .filter(Boolean)
      .join("\n"),
  ];

  if (agent?.prompt?.trim()) {
    sections.push(`[AGENT INSTRUCTIONS]\n${agent.prompt.trim()}`);
  }

  if (agent?.subagentPrompt?.trim()) {
    sections.push(
      `[SUBAGENT WORKER INSTRUCTIONS]\n${agent.subagentPrompt.trim()}`,
    );
  }

  if (
    metadata.preloadedSkillInstructions &&
    metadata.preloadedSkillInstructions.length > 0
  ) {
    sections.push(
      `[PRELOADED SKILLS]\n${metadata.preloadedSkillInstructions.join("\n\n")}`,
    );
  }

  sections.push(
    `REPORTING CONTRACT:
Provide your final text response starting with one of these exact status indicators:
- STATUS: DONE - when the task is completely finished.
- STATUS: DONE_WITH_CONCERNS - when completed, but ambiguities or risks were identified.
- STATUS: NEEDS_CONTEXT - when vital information is missing and could not be found with tools.
- STATUS: BLOCKED - when contradictions or tool errors prevent completion.

Follow the status with a concise summary (under 500 words) of your conclusions and any scratchpad file paths created.`,
  );

  return sections.join("\n\n");
}
