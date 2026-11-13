import { and, eq, inArray, or, sql } from "drizzle-orm";
import {
  getBuiltInAgentById,
  isBuiltInAgentId,
  LINKABLE_BUILT_IN_AGENT_IDS,
} from "@/config/built-in-agents";
import { db } from "@/drizzle/db";
import { agent } from "@/drizzle/schemas/agent-schema";
import { chat } from "@/drizzle/schemas/chat-schema";
import { knowledgebase } from "@/drizzle/schemas/knowledgebase-schema";
import {
  mcpServer,
  userMcpServerInstall,
} from "@/drizzle/schemas/mcp-server-schema";
import { project } from "@/drizzle/schemas/project-schema";
import { skill } from "@/drizzle/schemas/skill-schema";
import { resolveLinkedSubagents } from "@/lib/agents/resolve-linked-subagents";
import { mcpServerRowToConfig } from "@/lib/mcp/mcp-server-row-to-config";
import { retrieveRelevantMemories } from "@/lib/memory/retrieve-relevant-memories";
import { resolveContextSkills } from "@/lib/skills/resolve-context-skills";
import type { SkillMode } from "@/schemas/skill/skill-config";
import type { Agent } from "@/types/agent/agent";
import type { McpServerConfig } from "@/types/mcp/mcp-server-config";
import type { McpServerRow } from "@/types/mcp/mcp-server-row";
import type { SkillSummary } from "@/types/skill/skill";
import type { SkillRow } from "@/types/skill/skill-row";

interface LoadedAgentSummary {
  id: string;
  name: string;
  prompt: string | null;
  skillMode: SkillMode;
  skillIds: string[];
  knowledgebaseIds: string[];
  subagentIds: string[];
}

type ChatContext = {
  chatRow: {
    id: string;
    projectId: string | null;
    agentId: string | null;
    knowledgebaseId: string | null;
  };
  projectRow: {
    globalPrompt: string | null;
    knowledgebaseId: string | null;
    subagentIds: string[];
  } | null;
  activeKbId: string | null;
  activeKbIds: string[];
  kbIsReady: boolean;
  agentRow: LoadedAgentSummary | null;
  skillMode: SkillMode;
  skillIds: string[];
  servers: McpServerConfig[];
  availableSkills: SkillSummary[];
  selectedSkills: SkillRow[];
  userMemories: string[];
  linkedSubagents: Agent[];
};

async function loadAgentSummary(
  agentId: string | null,
  userId: string,
): Promise<LoadedAgentSummary | null> {
  if (!agentId) return null;
  if (isBuiltInAgentId(agentId)) {
    const builtIn = getBuiltInAgentById(agentId)!;
    return {
      id: builtIn.id,
      name: builtIn.name,
      prompt: builtIn.prompt,
      skillMode: builtIn.skillMode,
      skillIds: builtIn.skillIds,
      knowledgebaseIds: builtIn.knowledgebaseIds,
      subagentIds: builtIn.subagentIds,
    };
  }
  const rows = await db
    .select({
      id: agent.id,
      name: agent.name,
      prompt: agent.prompt,
      skillMode: agent.skillMode,
      skillIds: agent.skillIds,
      knowledgebaseIds: agent.knowledgebaseIds,
      subagentIds: agent.subagentIds,
    })
    .from(agent)
    .where(and(eq(agent.id, agentId), eq(agent.userId, userId)))
    .limit(1);
  return rows[0] ?? null;
}

/**
 * Loads all database context needed for a chat request in minimal queries.
 *
 * @param chatId - Chat UUID
 * @param userId - Authenticated user ID for authorization
 * @param selectedServerIds - Optional MCP server IDs to filter by
 * @param selectedKbIds - Optional knowledge base override from request body
 * @param selectedAgentId - Optional agent override from request body
 * @param selectedSkillIds - Optional skill IDs to manually inject
 * @param latestQuery - Latest user query for memory retrieval
 * @param selectedSubagentIds - Optional per-chat linked subagent IDs override
 * @returns Full chat execution context
 * @author Maruf Bepary
 */
export async function loadChatContext(
  chatId: string,
  userId: string,
  selectedServerIds?: string[],
  selectedKbIds?: string[],
  selectedAgentId?: string,
  selectedSkillIds?: string[],
  latestQuery?: string,
  selectedSubagentIds?: string[],
): Promise<ChatContext> {
  const [row] = await db
    .select({
      id: chat.id,
      projectId: chat.projectId,
      agentId: chat.agentId,
      knowledgebaseId: chat.knowledgebaseId,
      projectTableId: project.id,
      projectGlobalPrompt: project.globalPrompt,
      projectKnowledgebaseId: project.knowledgebaseId,
      projectSkillMode: project.skillMode,
      projectSkillIds: project.skillIds,
      projectSubagentIds: project.subagentIds,
    })
    .from(chat)
    .leftJoin(
      project,
      and(eq(project.id, chat.projectId), eq(project.userId, userId)),
    )
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId)));

  if (!row) {
    throw new ChatNotFoundError(chatId);
  }

  const chatRow = {
    id: row.id,
    projectId: row.projectId,
    agentId:
      row.agentId ??
      ((row as Record<string, unknown>).assistantId as string | null) ??
      null,
    knowledgebaseId: row.knowledgebaseId,
  };

  const projectRow =
    row.projectId && row.projectTableId
      ? {
          globalPrompt: row.projectGlobalPrompt,
          knowledgebaseId: row.projectKnowledgebaseId,
          subagentIds: row.projectSubagentIds ?? [],
        }
      : null;

  const candidateKbIds: string[] =
    selectedKbIds && selectedKbIds.length > 0
      ? selectedKbIds
      : [chatRow.knowledgebaseId ?? projectRow?.knowledgebaseId ?? null].filter(
          (id): id is string => Boolean(id),
        );

  const effectiveAgentId = chatRow.agentId || selectedAgentId || null;

  const [agentRow, servers, kbRows, userSkills, userMemories] =
    await Promise.all([
      loadAgentSummary(effectiveAgentId, userId),
      Promise.all([
        db
          .select({
            id: mcpServer.id,
            name: mcpServer.name,
            url: mcpServer.url,
            headers: mcpServer.headers,
            authType: mcpServer.authType,
            oauthClientId: mcpServer.oauthClientId,
            oauthClientSecret: mcpServer.oauthClientSecret,
            oauthScope: mcpServer.oauthScope,
          })
          .from(mcpServer)
          .where(
            and(eq(mcpServer.userId, userId), eq(mcpServer.enabled, true)),
          ),
        db
          .select({
            id: mcpServer.id,
            name: mcpServer.name,
            url: mcpServer.url,
            headers: userMcpServerInstall.headers,
            authType: mcpServer.authType,
            oauthClientId: userMcpServerInstall.oauthClientId,
            oauthClientSecret: userMcpServerInstall.oauthClientSecret,
            oauthScope: mcpServer.oauthScope,
          })
          .from(userMcpServerInstall)
          .innerJoin(mcpServer, eq(userMcpServerInstall.serverId, mcpServer.id))
          .where(
            and(
              eq(userMcpServerInstall.userId, userId),
              eq(userMcpServerInstall.enabled, true),
              eq(mcpServer.isPublic, true),
              eq(mcpServer.enabled, true),
            ),
          ),
      ]).then(([personal, installed]) =>
        [...personal, ...installed].map((r) =>
          mcpServerRowToConfig(r as McpServerRow, userId),
        ),
      ),
      (() => {
        if (candidateKbIds.length === 0) return Promise.resolve([]);
        if (candidateKbIds.length === 1) {
          return db
            .select({
              id: knowledgebase.id,
              indexStatus: knowledgebase.indexStatus,
            })
            .from(knowledgebase)
            .where(
              and(
                eq(knowledgebase.id, candidateKbIds[0]),
                eq(knowledgebase.userId, userId),
              ),
            )
            .limit(1);
        }
        return db
          .select({
            id: knowledgebase.id,
            indexStatus: knowledgebase.indexStatus,
          })
          .from(knowledgebase)
          .where(
            and(
              inArray(knowledgebase.id, candidateKbIds),
              eq(knowledgebase.userId, userId),
            ),
          );
      })(),
      (() => {
        const conditions = [eq(skill.userId, userId), eq(skill.enabled, true)];
        const isGlobal = sql`cardinality(${skill.projectIds}) = 0 AND cardinality(${skill.agentIds}) = 0`;
        const matchScope = [];

        if (chatRow.projectId) {
          matchScope.push(sql`${chatRow.projectId} = ANY(${skill.projectIds})`);
        }
        if (effectiveAgentId) {
          matchScope.push(sql`${effectiveAgentId} = ANY(${skill.agentIds})`);
        }

        if (matchScope.length > 0) {
          conditions.push(or(isGlobal, ...matchScope)!);
        } else {
          conditions.push(isGlobal);
        }

        return db
          .select()
          .from(skill)
          .where(and(...conditions)) as Promise<SkillRow[]>;
      })(),
      retrieveRelevantMemories(userId, latestQuery).catch(() => [] as string[]),
    ]);

  const extraAgentKbIds =
    !selectedKbIds?.length && agentRow?.knowledgebaseIds?.length
      ? agentRow.knowledgebaseIds.filter((id) => !candidateKbIds.includes(id))
      : [];

  const extraKbRows =
    extraAgentKbIds.length > 0
      ? await db
          .select({
            id: knowledgebase.id,
            indexStatus: knowledgebase.indexStatus,
          })
          .from(knowledgebase)
          .where(
            and(
              inArray(knowledgebase.id, extraAgentKbIds),
              eq(knowledgebase.userId, userId),
            ),
          )
      : [];

  const allCandidateKbIds = [...candidateKbIds, ...extraAgentKbIds];
  const allKbRows = [...kbRows, ...extraKbRows];

  const targetSubagentIds: readonly string[] =
    selectedSubagentIds !== undefined
      ? selectedSubagentIds
      : agentRow && agentRow.subagentIds?.length > 0
        ? agentRow.subagentIds
        : projectRow && projectRow.subagentIds.length > 0
          ? projectRow.subagentIds
          : LINKABLE_BUILT_IN_AGENT_IDS;

  const linkedSubagents = await resolveLinkedSubagents(
    userId,
    targetSubagentIds,
  );

  const skillMode: SkillMode =
    agentRow?.skillMode ?? row.projectSkillMode ?? "dynamic";
  const skillIds: string[] = agentRow?.skillIds ?? row.projectSkillIds ?? [];

  const activeKbIds = allKbRows
    .filter((k) => k.indexStatus === "ready")
    .map((k, idx) => k.id ?? allCandidateKbIds[idx])
    .filter(Boolean);
  const activeKbId = activeKbIds[0] ?? null;
  const kbIsReady = activeKbIds.length > 0;

  const filteredServers =
    selectedServerIds === undefined
      ? servers
      : selectedServerIds.length === 0
        ? []
        : servers.filter((s) => selectedServerIds.includes(s.id));

  const { availableSkills, selectedSkills } = resolveContextSkills({
    skillMode,
    skillIds,
    userSkills,
    chatSkillIds: selectedSkillIds,
  });

  return {
    chatRow,
    projectRow,
    activeKbId,
    activeKbIds,
    kbIsReady,
    agentRow,
    skillMode,
    skillIds,
    servers: filteredServers,
    availableSkills,
    selectedSkills,
    userMemories,
    linkedSubagents,
  };
}

/**
 * Error thrown when the requested chat does not exist or is not owned by the user.
 *
 * @author Maruf Bepary
 */
export class ChatNotFoundError extends Error {
  // fallow-ignore-next-line unused-class-member
  readonly code = "CHAT_NOT_FOUND" as const;
  readonly chatId: string;

  constructor(chatId: string) {
    super(`Chat '${chatId}' not found`);
    this.chatId = chatId;
    this.name = "ChatNotFoundError";
  }
}
