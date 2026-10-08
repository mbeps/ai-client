import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
  assistant,
  chat,
  knowledgebase,
  mcpServer,
  project,
  skill,
  userMcpServerInstall,
} from "@/drizzle/schema";
import { retrieveRelevantMemories } from "@/lib/memory/memory-service";
import { resolveContextSkills } from "@/lib/skills/resolve-context-skills";
import type { SkillMode } from "@/schemas/skill/skill-config";
import type { SkillSummary } from "@/types/skill/skill";
import type { SkillRow } from "@/types/skill/skill-row";

/**
 * All database context required for a single chat request.
 * Lazy-loads projects, assistants, knowledge bases, MCP servers, and Agent Skills.
 * Resolves effective configuration considering request-level overrides.
 * @author Maruf Bepary
 */
type ChatContext = {
  /** The chat row — always present if the chat exists */
  chatRow: {
    id: string;
    projectId: string | null;
    assistantId: string | null;
    knowledgebaseId: string | null;
  };
  /** Project row (null when chat has no project) */
  projectRow: {
    globalPrompt: string | null;
    knowledgebaseId: string | null;
  } | null;
  /** The effective primary KB id for this request */
  activeKbId: string | null;
  /** All effective ready KB ids for this request */
  activeKbIds: string[];
  /** Whether at least one active KB is ready */
  kbIsReady: boolean;
  /** Assistant prompt (null when no assistant is associated) */
  assistantRow: { prompt: string | null } | null;
  /** Effective skill mode inherited from the assistant, else the project, else `dynamic` */
  skillMode: SkillMode;
  /** Effective pre-configured skill IDs inherited from the assistant, else the project */
  skillIds: string[];
  /** Enabled MCP servers, optionally filtered by selectedServerIds */
  servers: Array<{
    id: string;
    name: string;
    url: string;
    headers: string | null;
  }>;
  /** Available skills for progressive disclosure catalog */
  availableSkills: SkillSummary[];
  /** Pre-selected skills to inject directly */
  selectedSkills: SkillRow[];
  /** Ambient user memories to inject into system prompt */
  userMemories: string[];
};

/**
 * Loads all database context needed for a chat request in minimal queries.
 * **Query pattern**: Chat lookup runs first (sequential dependency).
 * All remaining queries (project, assistant, servers, KB, skills) run in parallel after.
 *
 * @param chatId - Chat UUID
 * @param userId - Authenticated user ID for authorization
 * @param selectedServerIds - Optional MCP server IDs to filter by
 * @param selectedKbIds - Optional knowledge base override from request body
 * @param selectedAssistantId - Optional assistant override from request body
 * @param selectedSkillIds - Optional skill IDs to manually inject
 * @returns All context needed for streaming: prompts, KB readiness, servers, skills
 * @throws {Error} "Chat not found" when chat doesn't exist or doesn't belong to user
 * @author Maruf Bepary
 */
export async function loadChatContext(
  chatId: string,
  userId: string,
  selectedServerIds?: string[],
  selectedKbIds?: string[],
  selectedAssistantId?: string,
  selectedSkillIds?: string[],
  latestQuery?: string,
): Promise<ChatContext> {
  // 1. Chat and Project lookup (joined to resolve project context and KB in one query)
  const [row] = await db
    .select({
      id: chat.id,
      projectId: chat.projectId,
      assistantId: chat.assistantId,
      knowledgebaseId: chat.knowledgebaseId,
      projectTableId: project.id,
      projectGlobalPrompt: project.globalPrompt,
      projectKnowledgebaseId: project.knowledgebaseId,
      projectSkillMode: project.skillMode,
      projectSkillIds: project.skillIds,
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
    assistantId: row.assistantId,
    knowledgebaseId: row.knowledgebaseId,
  };

  const projectRow =
    row.projectId && row.projectTableId
      ? {
          globalPrompt: row.projectGlobalPrompt,
          knowledgebaseId: row.projectKnowledgebaseId,
        }
      : null;

  const candidateKbIds: string[] =
    selectedKbIds && selectedKbIds.length > 0
      ? selectedKbIds
      : [chatRow.knowledgebaseId ?? projectRow?.knowledgebaseId ?? null].filter(
          (id): id is string => Boolean(id),
        );

  // 2. Parallel queries that depend on chatRow and candidateKbIds
  const [assistantRow, servers, kbRows, userSkills, userMemories] =
    await Promise.all([
      // Assistant lookup (if applicable)
      (() => {
        const effectiveAssistantId =
          chatRow.assistantId || selectedAssistantId || null;
        return effectiveAssistantId
          ? db
              .select({
                prompt: assistant.prompt,
                skillMode: assistant.skillMode,
                skillIds: assistant.skillIds,
              })
              .from(assistant)
              .where(
                and(
                  eq(assistant.id, effectiveAssistantId),
                  eq(assistant.userId, userId),
                ),
              )
              .limit(1)
              .then((rows) => rows[0] ?? null)
          : Promise.resolve(null);
      })(),

      // Enabled MCP servers for this user (owned personal servers + installed public servers)
      Promise.all([
        db
          .select({
            id: mcpServer.id,
            name: mcpServer.name,
            url: mcpServer.url,
            headers: mcpServer.headers,
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
      ]).then(([personal, installed]) => [...personal, ...installed]),

      // KB readiness check (if applicable)
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

      // Enabled user skills
      db
        .select()
        .from(skill)
        .where(
          and(eq(skill.userId, userId), eq(skill.enabled, true)),
        ) as Promise<SkillRow[]>,

      // Ambient user memories
      retrieveRelevantMemories(userId, latestQuery).catch(() => [] as string[]),
    ]);

  // 3. Derive composite values
  const skillMode: SkillMode =
    assistantRow?.skillMode ?? row.projectSkillMode ?? "dynamic";
  const skillIds: string[] =
    assistantRow?.skillIds ?? row.projectSkillIds ?? [];

  const readyKbIds = kbRows
    .filter((k) => k.indexStatus === "ready")
    .map((k, idx) => k.id ?? candidateKbIds[idx])
    .filter(Boolean);
  const activeKbIds = readyKbIds;
  const activeKbId = activeKbIds[0] ?? null;
  const kbIsReady = activeKbIds.length > 0;

  // 4. Filter servers by selection if provided
  const filteredServers =
    selectedServerIds === undefined
      ? servers // Default to all enabled servers
      : selectedServerIds.length === 0
        ? [] // Explicitly no MCP servers
        : servers.filter((s) => selectedServerIds.includes(s.id));

  // 5. Resolve skill configuration (entity inheritance + per-chat selection)
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
    assistantRow,
    skillMode,
    skillIds,
    servers: filteredServers,
    availableSkills,
    selectedSkills,
    userMemories,
  };
}

export class ChatNotFoundError extends Error {
  readonly code = "CHAT_NOT_FOUND" as const;
  readonly chatId: string;

  constructor(chatId: string) {
    super(`Chat '${chatId}' not found`);
    this.chatId = chatId;
    this.name = "ChatNotFoundError";
  }
}
