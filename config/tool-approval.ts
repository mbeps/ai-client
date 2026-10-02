import type { ApprovalMode } from "@/types/tool/approval";

/**
 * Tools that run without asking. Every entry is read-only or purely
 * presentational: it either renders something the user already asked for, or
 * it reads data the user can already see.
 *
 * @decision Anything that writes, deletes, spends, or reaches the network
 * requires approval. That includes all five skill-authoring tools and every
 * tool contributed by an MCP server, because their behaviour is not knowable
 * from this repository. Add a name here only with a reason.
 * @author Maruf Bepary
 */
export const AUTO_APPROVED_TOOLS: ReadonlySet<string> = new Set([
  "manage_artifact",
  "get_file_url",
  "load_skill",
  "read_skill_file",
  "search_knowledge_base",
]);

/** Per-tool approval status, as the AI SDK expects it. */
export type ToolApprovalMap = Record<
  string,
  "user-approval" | "not-applicable"
>;

/**
 * Builds the `toolApproval` map handed to `streamText`.
 *
 * Every supplied name receives an explicit status. A tool missing from the map
 * is executed with no approval at all (V14), so an incomplete map is a silent
 * hole in the permission gate rather than a safe default. Unknown names
 * therefore fail closed with `"user-approval"`.
 *
 * @param toolNames - Every tool name registered for this run.
 * @param mode - "ask" to gate, "auto" to run everything.
 * @returns Approval status for each supplied tool name.
 * @author Maruf Bepary
 */
export function buildToolApproval(
  toolNames: readonly string[],
  mode: ApprovalMode,
): ToolApprovalMap {
  const map: ToolApprovalMap = {};
  for (const name of toolNames) {
    map[name] =
      mode === "auto" || AUTO_APPROVED_TOOLS.has(name)
        ? "not-applicable"
        : "user-approval";
  }
  return map;
}
