"use client";

import { Bot, ShieldCheck } from "lucide-react";
import { AgentOptions } from "@/components/agent/agent-options";
import { EntityCard } from "@/components/shared/entity-card";
import { Badge } from "@/components/ui/badge";
import { ROUTES } from "@/config/routes";
import type { Agent } from "@/types/agent/agent";

/**
 * Props for the AgentCard component.
 */
interface AgentCardProps {
  agent: Agent;
}

/**
 * Card displaying agent name, description, structural role badge (Built-in, Orchestrator, Subagent),
 * and usage count for the `/agents` listing page. Clicking opens the agent workspace.
 */
export function AgentCard({ agent }: AgentCardProps) {
  const isOrchestrator =
    Boolean(agent.isOrchestrator) || agent.subagentIds.length > 0;

  return (
    <EntityCard
      href={ROUTES.AGENTS.detail(agent.id)}
      icon={
        agent.isBuiltIn ? (
          <ShieldCheck className="text-primary h-5 w-5" />
        ) : (
          <Bot className="text-primary h-5 w-5" />
        )
      }
      title={
        <div className="flex flex-wrap items-center gap-1.5">
          <h3 className="truncate">{agent.name}</h3>
          {agent.isBuiltIn ? (
            <Badge variant="secondary" className="text-[10px]">
              Built-in
            </Badge>
          ) : isOrchestrator ? (
            <Badge variant="default" className="text-[10px]">
              Orchestrator ({agent.subagentIds.length})
            </Badge>
          ) : (
            <Badge variant="outline" className="text-[10px]">
              Subagent
            </Badge>
          )}
          {(agent.usedByCount ?? 0) > 0 && (
            <Badge variant="outline" className="text-[10px]">
              Used by {agent.usedByCount}
            </Badge>
          )}
        </div>
      }
      description={agent.description}
      menu={<AgentOptions agent={agent} />}
    />
  );
}
