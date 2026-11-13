import { listAgents } from "@/actions/agents/list-agents";
import { listChats } from "@/actions/chats/list-chats";
import { listProjects } from "@/actions/projects/list-projects";
import { SearchClient } from "@/app/(main)/search/_components/search-client";
import type { AgentRow } from "@/types/agent/agent-row";
import type { ChatRow } from "@/types/chat/chat-row";
import type { ProjectRow } from "@/types/project/project-row";

/**
 * Global search page: Unified interface for finding chats, projects, and agents.
 *
 * Route: /search. Server component fetching all user resources in parallel.
 * Aggregates chats, projects, and agents into single searchable list with
 * type-based filtering (all, chat, project, agent). Protected route.
 *
 * @author Maruf Bepary
 */
export default async function SearchPage() {
  const [chatRes, projectRes, agentRes] = await Promise.all([
    listChats().catch(() => ({ ok: false }) as const),
    listProjects().catch(() => ({ ok: false }) as const),
    listAgents().catch(() => ({ ok: false }) as const),
  ]);

  const chatRows: ChatRow[] = chatRes.ok ? chatRes.value : [];
  const projectRows: ProjectRow[] = projectRes.ok ? projectRes.value : [];
  const agentRows: AgentRow[] = agentRes.ok ? agentRes.value : [];

  const chats = chatRows.map((row) => ({
    id: row.id,
    title: row.title,
    projectId: row.projectId ?? undefined,
    agentId: row.agentId ?? undefined,
    assistantId: row.agentId ?? undefined,
    knowledgebaseId: row.knowledgebaseId ?? null,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
    messages: {},
    currentLeafId: row.currentLeafId ?? null,
  }));
  const projects = projectRows.map((row) => ({
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description ?? "",
    globalPrompt: row.globalPrompt ?? "",
    tools: row.tools ?? [],
    skillMode: row.skillMode as "dynamic" | "none" | "specific",
    skillIds: row.skillIds ?? [],
    promptMode: (row.promptMode ?? "all") as "all" | "none" | "specific",
    promptIds: row.promptIds ?? [],
    knowledgebaseId: row.knowledgebaseId ?? null,
    subagentIds: row.subagentIds ?? [],
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  }));
  const agents = agentRows.map((row) => ({
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description ?? "",
    prompt: row.prompt ?? "",
    tools: row.tools ?? [],
    skillMode: row.skillMode as "dynamic" | "none" | "specific",
    skillIds: row.skillIds ?? [],
    promptMode: (row.promptMode ?? "all") as "all" | "none" | "specific",
    promptIds: row.promptIds ?? [],
    avatar: row.avatar ?? null,
    subagentPrompt: row.subagentPrompt ?? "",
    modelId: row.modelId ?? null,
    knowledgebaseIds: [],
    subagentIds: row.subagentIds ?? [],
    guardrails: row.guardrails ?? null,
    isBuiltIn: false,
    isOrchestrator: (row.subagentIds?.length ?? 0) > 0,
    usedByCount: 0,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  }));

  return (
    <SearchClient
      initialChats={chats}
      initialProjects={projects}
      initialAgents={agents}
    />
  );
}
