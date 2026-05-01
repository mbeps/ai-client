"use client";

import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ResourceListPage } from "@/components/shared/resource-list-page";
import { ChatCard } from "@/components/chat/chat-card";
import { ProjectCard } from "@/components/project/project-card";
import { AssistantCard } from "@/components/assistant/assistant-card";
import type { Chat } from "@/types/chat";
import type { Project } from "@/types/project";
import type { Assistant } from "@/types/assistant";

interface SearchClientProps {
  initialChats: Chat[];
  initialProjects: Project[];
  initialAssistants: Assistant[];
}

type SearchItem =
  | { type: "chat"; data: Chat; id: string; updatedAt: Date }
  | { type: "project"; data: Project; id: string; updatedAt: Date }
  | { type: "assistant"; data: Assistant; id: string; updatedAt: Date };

/**
 * Client-side component for the global search page.
 * Aggregates chats, projects, and assistants into a unified searchable list.
 * Uses the shared ResourceListPage for a consistent layout.
 *
 * @author Maruf Bepary
 */
export function SearchClient({
  initialChats,
  initialProjects,
  initialAssistants,
}: SearchClientProps) {
  const [filterType, setFilterType] = useState<"all" | "chat" | "project" | "assistant">("all");

  const items = useMemo<SearchItem[]>(() => {
    const chats: SearchItem[] = initialChats.map((chat) => ({
      type: "chat",
      data: chat,
      id: chat.id,
      updatedAt: chat.updatedAt,
    }));

    const projects: SearchItem[] = initialProjects.map((project) => ({
      type: "project",
      data: project,
      id: project.id,
      updatedAt: project.updatedAt,
    }));

    const assistants: SearchItem[] = initialAssistants.map((assistant) => ({
      type: "assistant",
      data: assistant,
      id: assistant.id,
      updatedAt: assistant.updatedAt,
    }));

    return [...chats, ...projects, ...assistants];
  }, [initialChats, initialProjects, initialAssistants]);

  const filterFn = (item: SearchItem, query: string) => {
    const q = query.toLowerCase();
    switch (item.type) {
      case "chat":
        return item.data.title.toLowerCase().includes(q);
      case "project":
      case "assistant":
        return item.data.name.toLowerCase().includes(q);
      default:
        return false;
    }
  };

  const customFilterFn = (item: SearchItem) => {
    if (filterType === "all") return true;
    return item.type === filterType;
  };

  const renderList = (items: SearchItem[]) => {
    const projects = items.filter((i) => i.type === "project");
    const assistants = items.filter((i) => i.type === "assistant");
    const chats = items.filter((i) => i.type === "chat");

    return (
      <div className="space-y-10">
        {projects.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-xl font-bold tracking-tight">Projects</h2>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                {projects.length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {projects.map((item) => (
                <ProjectCard key={item.id} project={item.data} />
              ))}
            </div>
          </section>
        )}

        {assistants.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-xl font-bold tracking-tight">Assistants</h2>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                {assistants.length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {assistants.map((item) => (
                <AssistantCard key={item.id} assistant={item.data} />
              ))}
            </div>
          </section>
        )}

        {chats.length > 0 && (
          <section>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-xl font-bold tracking-tight">Chats</h2>
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-secondary text-secondary-foreground">
                {chats.length}
              </span>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {chats.map((item) => (
                <ChatCard key={item.id} chat={item.data} />
              ))}
            </div>
          </section>
        )}
      </div>
    );
  };

  return (
    <ResourceListPage
      icon={<Search className="h-8 w-8 text-primary" />}
      title="Global Search"
      description="Search across all your chats, projects, and assistants."
      items={items}
      emptyStateMessage="No resources found matching your search."
      searchPlaceholder="Search everything..."
      filterFn={filterFn}
      customFilterFn={customFilterFn}
      renderList={renderList}
      extraFilters={
        <Select
          value={filterType}
          onValueChange={(val: any) => setFilterType(val)}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="chat">Chats</SelectItem>
            <SelectItem value="project">Projects</SelectItem>
            <SelectItem value="assistant">Assistants</SelectItem>
          </SelectContent>
        </Select>
      }
    />
  );
}
