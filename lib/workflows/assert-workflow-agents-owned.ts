import { and, eq, inArray } from "drizzle-orm";
import { isBuiltInAgentId } from "@/config/built-in-agents";
import { db } from "@/drizzle/db";
import { agent } from "@/drizzle/schemas/agent-schema";
import type { WorkflowNode } from "@/types/workflows/workflow";

/**
 * Verifies that all custom `agentId`s referenced by `ai_step` nodes belong to `userId`.
 * Built-in system agent IDs are always permitted.
 */
export async function assertWorkflowAgentsOwned(
  userId: string,
  nodes: WorkflowNode[] | undefined,
): Promise<boolean> {
  const customAgentIds = [
    ...new Set(
      (nodes ?? [])
        .map((node) =>
          node.data.kind === "ai_step" ? node.data.agentId : undefined,
        )
        .filter(
          (id): id is string =>
            typeof id === "string" && id.length > 0 && !isBuiltInAgentId(id),
        ),
    ),
  ];

  if (customAgentIds.length === 0) {
    return true;
  }

  const ownedRows = await db
    .select({ id: agent.id })
    .from(agent)
    .where(and(inArray(agent.id, customAgentIds), eq(agent.userId, userId)));

  return ownedRows.length === customAgentIds.length;
}
