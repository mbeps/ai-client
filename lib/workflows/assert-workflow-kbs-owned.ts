import { filterOwnedKbIds } from "@/lib/knowledgebases/filter-owned-kb-ids";
import type { WorkflowNode } from "@/types/workflows/workflow";

/**
 * Verifies that all workflow-level and AI-node override knowledge base IDs belong to `userId`.
 */
export async function assertWorkflowKbsOwned(
  userId: string,
  workflowKbIds: string[] | undefined,
  nodes: WorkflowNode[] | undefined,
): Promise<boolean> {
  const nodeKbIds = (nodes ?? []).flatMap((node) =>
    node.data.kind === "ai_step" ? (node.data.knowledgeBaseIds ?? []) : [],
  );
  const uniqueKbIds = [
    ...new Set([...(workflowKbIds ?? []), ...nodeKbIds].filter(Boolean)),
  ];
  if (uniqueKbIds.length === 0) {
    return true;
  }
  const ownedKbIds = await filterOwnedKbIds(userId, uniqueKbIds);
  return ownedKbIds.length === uniqueKbIds.length;
}
