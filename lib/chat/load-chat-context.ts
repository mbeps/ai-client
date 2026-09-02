import { and, eq, or } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
  assistant,
  chat,
  knowledgebase,
  mcpServer,
  project,
  skill,
} from "@/drizzle/schema";
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
  /** The effective KB id for this request */
  activeKbId: string | null;
  /** Whether the active KB has been fully indexed */
  kbIsReady: boolean;
  /** Assistant prompt (null when no assistant is associated) */
  assistantRow: { prompt: string | null } | null;
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
): Promise<ChatContext> {
  // 1. Chat lookup (sequential — everything below depends on it)
  const [chatRow] = await db
    .select({
      id: chat.id,
      projectId: chat.projectId,
      assistantId: chat.assistantId,
      knowledgebaseId: chat.knowledgebaseId,
    })
    .from(chat)
    .where(and(eq(chat.id, chatId), eq(chat.userId, userId)));

  if (!chatRow) {
    throw new ChatNotFoundError(chatId);
  }

  // 2. Parallel queries that depend on chatRow
  const [projectRow, assistantRow, servers, kbRow, userSkills] =
    await Promise.all([
      // Project lookup (if applicable)
      chatRow.projectId
        ? db
            .select({
              globalPrompt: project.globalPrompt,
              knowledgebaseId: project.knowledgebaseId,
            })
            .from(project)
            .where(
              and(
                eq(project.id, chatRow.projectId),
                eq(project.userId, userId),
              ),
            )
            .limit(1)
            .then((rows) => rows[0] ?? null)
        : Promise.resolve(null),

      // Assistant lookup (if applicable)
      (() => {
        const effectiveAssistantId =
          chatRow.assistantId || selectedAssistantId || null;
        return effectiveAssistantId
          ? db
              .select({ prompt: assistant.prompt })
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

      // Enabled MCP servers for this user
      db
        .select({
          id: mcpServer.id,
          name: mcpServer.name,
          url: mcpServer.url,
          headers: mcpServer.headers,
        })
        .from(mcpServer)
        .where(
          and(
            or(eq(mcpServer.userId, userId), eq(mcpServer.isPublic, true)),
            eq(mcpServer.enabled, true),
          ),
        ),

      // KB readiness check (if applicable)
      (() => {
        const activeKbId =
          selectedKbIds?.[0] ?? chatRow.knowledgebaseId ?? null;
        if (!activeKbId) return Promise.resolve(null);
        return db
          .select({ indexStatus: knowledgebase.indexStatus })
          .from(knowledgebase)
          .where(
            and(
              eq(knowledgebase.id, activeKbId),
              eq(knowledgebase.userId, userId),
            ),
          )
          .limit(1)
          .then((rows) => rows[0] ?? null);
      })(),

      // Enabled user skills
      db
        .select()
        .from(skill)
        .where(
          and(eq(skill.userId, userId), eq(skill.enabled, true)),
        ) as Promise<SkillRow[]>,
    ]);

  // 3. Derive composite values
  const activeKbId =
    selectedKbIds?.[0] ??
    chatRow.knowledgebaseId ??
    projectRow?.knowledgebaseId ??
    null;

  const kbIsReady = activeKbId ? kbRow?.indexStatus === "ready" : false;

  // 4. Filter servers by selection if provided
  const filteredServers =
    selectedServerIds === undefined
      ? servers // Default to all enabled servers
      : selectedServerIds.length === 0
        ? [] // Explicitly no MCP servers
        : servers.filter((s) => selectedServerIds.includes(s.id));

  // 5. Build available skills summary & match selected skills
  const availableSkills: SkillSummary[] = userSkills.map((s) => ({
    name: s.name,
    displayName: s.displayName,
    description: s.description,
  }));

  const selectedSkills: SkillRow[] =
    selectedSkillIds && selectedSkillIds.length > 0
      ? userSkills.filter(
          (s) =>
            selectedSkillIds.includes(s.id) ||
            selectedSkillIds.includes(s.name),
        )
      : [];

  return {
    chatRow,
    projectRow,
    activeKbId,
    kbIsReady,
    assistantRow,
    servers: filteredServers,
    availableSkills,
    selectedSkills,
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
