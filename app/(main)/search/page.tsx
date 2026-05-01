import { listChats } from "@/lib/actions/chats/list-chats";
import { listProjects } from "@/lib/actions/projects/list-projects";
import { listAssistants } from "@/lib/actions/assistants/list-assistants";
import { chatRowToStore } from "@/lib/store/mappers/chat";
import { projectRowToStore } from "@/lib/store/mappers/project";
import { assistantRowToStore } from "@/lib/store/mappers/assistant";
import { SearchClient } from "./_components/search-client";
import type { ChatRow } from "@/types/chat-row";
import type { ProjectRow } from "@/types/project-row";
import type { AssistantRow } from "@/types/assistant-row";

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

  const chats = chatRows.map(chatRowToStore);
  const projects = projectRows.map(projectRowToStore);
  const assistants = assistantRows.map(assistantRowToStore);

  return (
    <SearchClient
      initialChats={chats}
      initialProjects={projects}
      initialAssistants={assistants}
    />
  );
}
