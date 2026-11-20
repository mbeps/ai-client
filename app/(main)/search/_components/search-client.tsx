"use client";

import { Search } from "lucide-react";
import { useMemo, useState } from "react";
import { AgentCard } from "@/components/agent/agent-card";
import { ChatCard } from "@/components/chat/chat-card";
import { ProjectCard } from "@/components/project/project-card";
import { ResourceListPage } from "@/components/shared/resource-list-page";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Agent } from "@/types/agent/agent";
import type { Chat } from "@/types/chat/chat";
import type { Project } from "@/types/project/project";

/**
 * Represents search client props.
 *
 * @author Maruf Bepary
 */
interface SearchClientProps {
  initialChats: Chat[];
  initialProjects: Project[];
  initialAgents: Agent[];
}

/**
 * Represents search item.
 *
 * @author Maruf Bepary
 */
type SearchItem =
  | { type: "chat"; data: Chat; id: string; updatedAt: Date }
  | { type: "project"; data: Project; id: string; updatedAt: Date }
  | { type: "agent"; data: Agent; id: string; updatedAt: Date };
/**
 * Search client: Unified search interface for chats, projects, and agents.
 *
 * Accepts server-fetched resources and renders searchable grid with type filtering.
 * Groups results by type (Projects, Agents, Chats). Supports filtering by
 * resource type (all, chat, project, agent). Each card links to detail page.
 *
 * @author Maruf Bepary
 */
export function SearchClient({
  initialChats,
  initialProjects,
  initialAgents,
}: SearchClientProps) {
  const [filterType, setFilterType] = useState<
    "all" | "chat" | "project" | "agent"
  >("all");

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

    const agents: SearchItem[] = initialAgents.map((agent) => ({
      type: "agent",
      data: agent,
      id: agent.id,
      updatedAt: agent.updatedAt,
    }));

    return [...chats, ...projects, ...agents];
  }, [initialChats, initialProjects, initialAgents]);

  const filterFn = (item: SearchItem, query: string) => {
    const q = query.toLowerCase();
    switch (item.type) {
      case "chat":
        return item.data.title.toLowerCase().includes(q);
      case "project":
      case "agent":
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
    const agents = items.filter((i) => i.type === "agent");
    const chats = items.filter((i) => i.type === "chat");

    return (
      <div className="space-y-10">
        {projects.length > 0 && (
          <section>
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">Projects</h2>
              <Badge variant="secondary" className="font-mono text-xs">
                {projects.length}
              </Badge>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {projects.map((item) => (
                <ProjectCard key={item.id} project={item.data} />
              ))}
            </div>
          </section>
        )}

        {agents.length > 0 && (
          <section>
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">Agents</h2>
              <Badge variant="secondary" className="font-mono text-xs">
                {agents.length}
              </Badge>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {agents.map((item) => (
                <AgentCard key={item.id} agent={item.data} />
              ))}
            </div>
          </section>
        )}

        {chats.length > 0 && (
          <section>
            <div className="mb-4 flex items-center gap-2">
              <h2 className="text-xl font-bold tracking-tight">Chats</h2>
              <Badge variant="secondary" className="font-mono text-xs">
                {chats.length}
              </Badge>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
      icon={<Search className="text-primary h-8 w-8" />}
      title="Global Search"
      description="Search across all your chats, projects, and agents."
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
          <SelectTrigger className="w-full md:w-[180px]">
            <SelectValue placeholder="Filter by type" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="chat">Chats</SelectItem>
            <SelectItem value="project">Projects</SelectItem>
            <SelectItem value="agent">Agents</SelectItem>
          </SelectContent>
        </Select>
      }
    />
  );
}
