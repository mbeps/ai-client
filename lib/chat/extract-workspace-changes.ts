/** Workspace entity domains that can be mutated by chat tools. */
export type WorkspaceChangeDomain =
  | "skills"
  | "projects"
  | "agents"
  | "prompts"
  | "workflows"
  | "memories";

const TOOL_DOMAIN_MAP: Record<string, WorkspaceChangeDomain | undefined> = {
  manage_skill: "skills",
  create_skill: "skills",
  update_skill: "skills",
  write_skill_file: "skills",
  delete_skill_file: "skills",
  manage_project: "projects",
  manage_agent: "agents",
  manage_prompt: "prompts",
  manage_workflow: "workflows",
  save_memory: "memories",
  manage_memory: "memories",
};

function readPayload(raw: unknown): Record<string, unknown> | null {
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return parsed && typeof parsed === "object"
        ? (parsed as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }
  return raw && typeof raw === "object"
    ? (raw as Record<string, unknown>)
    : null;
}

function isSuccessfulMutation(payload: Record<string, unknown>): boolean {
  if (payload.success === false || payload.error) {
    return false;
  }
  if (payload.success === true) {
    return true;
  }
  return (
    (typeof payload.skillId === "string" && payload.skillId.length > 0) ||
    (typeof payload.id === "string" && payload.id.length > 0)
  );
}

/**
 * Inspects completed tool results after a chat stream finishes and returns the
 * set of workspace store domains that need a background reload.
 *
 * @param toolResults - Completed tool calls/results array
 * @returns Set of affected workspace domains
 */
export function extractWorkspaceChangesFromToolResults(
  toolResults: unknown,
): Set<WorkspaceChangeDomain> {
  const domains = new Set<WorkspaceChangeDomain>();
  if (!Array.isArray(toolResults)) return domains;

  for (const entry of toolResults) {
    if (!entry || typeof entry !== "object") continue;
    const record = entry as Record<string, unknown>;
    if (typeof record.toolName !== "string") continue;

    const domain = TOOL_DOMAIN_MAP[record.toolName];
    if (!domain) continue;

    const payload = readPayload(record.result);
    if (!payload || !isSuccessfulMutation(payload)) continue;

    domains.add(domain);
  }

  return domains;
}
