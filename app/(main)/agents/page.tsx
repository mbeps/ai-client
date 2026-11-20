"use client";

import { Bot, Plus } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { AgentCard } from "@/components/agent/agent-card";
import { ResourceListPage } from "@/components/shared/resource-list-page";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ROUTES } from "@/config/routes";
import { useAppStore } from "@/lib/store/use-app-store";
import type { Agent } from "@/types/agent/agent";

type AgentFilterTab = "all" | "my" | "orchestrators" | "leaf" | "built-in";

function matchesAgentFilter(agent: Agent, filter: AgentFilterTab): boolean {
  switch (filter) {
    case "my":
      return !agent.isBuiltIn;
    case "orchestrators":
      return (
        !agent.isBuiltIn &&
        (Boolean(agent.isOrchestrator) || agent.subagentIds.length > 0)
      );
    case "leaf":
      return (
        !agent.isBuiltIn &&
        !agent.isOrchestrator &&
        agent.subagentIds.length === 0
      );
    case "built-in":
      return Boolean(agent.isBuiltIn);
    default:
      return true;
  }
}

/**
 * Unified Agents listing page (/agents).
 * Displays custom user Agents and read-only Built-in System Agents with role filter tabs.
 */
export default function AgentsPage() {
  const agents = useAppStore((state) => state.agents);
  const loadAgents = useAppStore((state) => state.loadAgents);
  const [filterTab, setFilterTab] = useState<AgentFilterTab>("all");

  return (
    <ResourceListPage
      icon={<Bot className="text-primary h-8 w-8" />}
      title="Agents"
      description="Unified AI personas for direct chats and delegated Layer-2 subagent tasks."
      items={agents}
      renderCard={(agent) => <AgentCard agent={agent} />}
      emptyStateMessage="No agents match the current filter."
      searchPlaceholder="Search agents..."
      onMount={loadAgents}
      extraFilters={
        <Tabs
          value={filterTab}
          onValueChange={(v) => setFilterTab(v as AgentFilterTab)}
        >
          <TabsList>
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="my">My Agents</TabsTrigger>
            <TabsTrigger value="orchestrators">Orchestrators</TabsTrigger>
            <TabsTrigger value="leaf">Subagents</TabsTrigger>
            <TabsTrigger value="built-in">Built-in</TabsTrigger>
          </TabsList>
        </Tabs>
      }
      customFilterFn={(agent) => matchesAgentFilter(agent, filterTab)}
      action={
        <Button asChild className="w-full md:w-auto">
          <Link href={ROUTES.AGENTS.new}>
            <Plus className="mr-2 h-4 w-4" />
            Create Agent
          </Link>
        </Button>
      }
      filterFn={(a, q) =>
        a.name.toLowerCase().includes(q.toLowerCase()) ||
        a.description.toLowerCase().includes(q.toLowerCase())
      }
    />
  );
}
