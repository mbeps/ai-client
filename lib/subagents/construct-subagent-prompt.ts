import type { SUBAGENT_ROLES } from "@/lib/subagents/subagent-role";

type SubagentRole = (typeof SUBAGENT_ROLES)[number];

interface SubagentExecutionMetadata {
  isSubagent: true;
  agentRole: SubagentRole;
  parentInvocationId: string;
  runId: string;
  allocatedModel: string;
}

export function constructSubagentPrompt(
  metadata: SubagentExecutionMetadata,
): string {
  return `
[SYSTEM IDENTITY: ISOLATED WORKER SUBAGENT]
Role: ${metadata.agentRole.toUpperCase()}
Execution Mode: Layer 1 Worker
Topological Constraints:
1. You are operating as an isolated subagent under an orchestrating agent.
2. You cannot spawn subordinate agents (depth limit d=1).
3. You cannot manipulate the user's canvas or create artifacts directly.
4. Use scratchpad_write to store intermediate findings, extensive document extracts, structured outlines, or tables for peer access and user inspection.
5. Conclude your work with a clear, self-contained summary adhering to your reporting contract.

REPORTING CONTRACT:
Provide your final text response starting with one of these exact status indicators:
- STATUS: DONE - when the task is completely finished.
- STATUS: DONE_WITH_CONCERNS - when completed, but ambiguities or risks were identified.
- STATUS: NEEDS_CONTEXT - when vital information is missing and could not be found with tools.
- STATUS: BLOCKED - when contradictions or tool errors prevent completion.

Follow the status with a concise summary (under 500 words) of your conclusions and any scratchpad file paths created.
`.trim();
}
