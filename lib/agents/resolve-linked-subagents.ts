import { and, eq, inArray } from "drizzle-orm";
import {
  getBuiltInAgentById,
  isBuiltInAgentId,
} from "@/config/built-in-agents";
import { db } from "@/drizzle/db";
import {
  agent,
  DEFAULT_AGENT_GUARDRAILS,
} from "@/drizzle/schemas/agent-schema";
import type { Agent } from "@/types/agent/agent";
import type { AgentRow } from "@/types/agent/agent-row";

function mapAgentRowToEntity(row: AgentRow): Agent {
  const subagentIds = row.subagentIds ?? [];
  return {
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description ?? "",
    prompt: row.prompt ?? "",
    subagentPrompt: row.subagentPrompt ?? "",
    modelId: row.modelId ?? null,
    knowledgebaseIds: row.knowledgebaseIds ?? [],
    tools: row.tools ?? [],
    skillMode: row.skillMode ?? "dynamic",
    skillIds: row.skillIds ?? [],
    promptMode: row.promptMode ?? "all",
    promptIds: row.promptIds ?? [],
    subagentIds,
    guardrails: row.guardrails ?? DEFAULT_AGENT_GUARDRAILS,
    avatar: row.avatar ?? null,
    isBuiltIn: false,
    isOrchestrator: subagentIds.length > 0,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

/**
 * Resolves a list of linked subagent IDs (built-in or user-owned custom agents)
 * into full `Agent` entities in the original order.
 *
 * @param userId - Authenticated user ID for custom agent ownership filtering
 * @param targetIds - Linked subagent IDs to resolve
 * @returns Resolved `Agent` entities
 * @author Maruf Bepary
 */
export async function resolveLinkedSubagents(
  userId: string,
  targetIds: readonly string[],
): Promise<Agent[]> {
  if (targetIds.length === 0) {
    return [];
  }

  const builtInMap = new Map<string, Agent>();
  const customIds: string[] = [];

  for (const id of targetIds) {
    if (isBuiltInAgentId(id)) {
      builtInMap.set(id, getBuiltInAgentById(id)!);
    } else {
      customIds.push(id);
    }
  }

  const customMap = new Map<string, Agent>();
  if (customIds.length > 0) {
    const rows = (await db
      .select()
      .from(agent)
      .where(
        and(inArray(agent.id, customIds), eq(agent.userId, userId)),
      )) as AgentRow[];
    for (const row of rows) {
      customMap.set(row.id, mapAgentRowToEntity(row));
    }
  }

  return targetIds
    .map((id) => builtInMap.get(id) ?? customMap.get(id))
    .filter((a): a is Agent => Boolean(a));
}
