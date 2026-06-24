import { listChats } from "@/lib/actions/chats/list-chats";
import { listProjects } from "@/lib/actions/projects/list-projects";
import { listAssistants } from "@/lib/actions/assistants/list-assistants";

import { SearchClient } from "./_components/search-client";
import type { ChatRow } from "@/types/chat/chat-row";
import type { ProjectRow } from "@/types/project/project-row";
import type { AssistantRow } from "@/types/assistant/assistant-row";

/**
 * Global search page — server component fetching all user resources.
 * Fetches chats, projects, and assistants concurrently.
 * Displays a unified searchable interface.
 *
 * @author Maruf Bepary
 */
export default async function SearchPage() {
  const [chatRows, projectRows, assistantRows] = await Promise.all([
    listChats().catch(() => [] as ChatRow[]),
    listProjects().catch(() => [] as ProjectRow[]),
    listAssistants().catch(() => [] as AssistantRow[]),
  ]);

  const chats = chatRows.map((row) => ({
    id: row.id,
    title: row.title,
    projectId: row.projectId ?? undefined,
    assistantId: row.assistantId ?? undefined,
    knowledgebaseId: row.knowledgebaseId ?? null,
    updatedAt: new Date(row.updatedAt),
    messages: {},
    currentLeafId: row.currentLeafId ?? null,
  }));
  const projects = projectRows.map((row) => ({
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description ?? "",
    isPinned: row.isPinned,
    globalPrompt: row.globalPrompt ?? "",
    tools: row.tools ?? [],
    knowledgebaseId: row.knowledgebaseId ?? null,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  }));
  const assistants = assistantRows.map((row) => ({
    id: row.id,
    userId: row.userId,
    name: row.name,
    description: row.description ?? "",
    prompt: row.prompt ?? "",
    tools: row.tools ?? [],
    avatar: row.avatar ?? null,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  }));

  return (
    <SearchClient
      initialChats={chats}
      initialProjects={projects}
      initialAssistants={assistants}
    />
  );
}
