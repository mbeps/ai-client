"use client";

import { Bot, ShieldCheck } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types/agent/agent";

/**
 * Props for the SubagentPicker component.
 */
export interface SubagentPickerProps {
  agents: Agent[];
  selectedIds: string[];
  onToggle: (agentId: string) => void;
  excludeAgentId?: string;
  disabled?: boolean;
  emptyMessage?: string;
}

/**
 * Multi-select picker of eligible Leaf Agents (custom leaf agents + linkable built-in agents).
 * Excludes orchestrator agents (2-layer invariant), `builtin:kb-reader`, and `excludeAgentId`.
 */
export function SubagentPicker({
  agents,
  selectedIds,
  onToggle,
  excludeAgentId,
  disabled = false,
  emptyMessage = "No eligible leaf agents available.",
}: SubagentPickerProps) {
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const { builtInAgents, customLeafAgents } = useMemo(() => {
    const eligible = agents.filter(
      (a) =>
        !a.isOrchestrator &&
        a.subagentIds.length === 0 &&
        a.id !== excludeAgentId &&
        a.id !== "builtin:kb-reader",
    );
    return {
      builtInAgents: eligible.filter((a) => a.isBuiltIn),
      customLeafAgents: eligible.filter((a) => !a.isBuiltIn),
    };
  }, [agents, excludeAgentId]);

  if (builtInAgents.length === 0 && customLeafAgents.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">
        {emptyMessage}
      </p>
    );
  }

  const renderGroup = (title: string, groupAgents: Agent[]) => {
    if (groupAgents.length === 0) return null;
    return (
      <div className="space-y-2">
        <p className="text-muted-foreground text-xs font-semibold tracking-wider uppercase">
          {title}
        </p>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {groupAgents.map((agent) => {
            const checked = selectedSet.has(agent.id);
            return (
              <label
                key={agent.id}
                className={cn(
                  "flex items-start gap-3 rounded-lg border p-3 transition-colors",
                  checked ? "border-primary bg-primary/5" : "hover:bg-muted/50",
                  disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
                )}
              >
                <Checkbox
                  checked={checked}
                  disabled={disabled}
                  onCheckedChange={() => {
                    if (!disabled) onToggle(agent.id);
                  }}
                  className="mt-0.5"
                />
                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex items-center gap-2">
                    {agent.isBuiltIn ? (
                      <ShieldCheck className="text-primary h-4 w-4 shrink-0" />
                    ) : (
                      <Bot className="text-primary h-4 w-4 shrink-0" />
                    )}
                    <span className="truncate text-sm font-medium">
                      {agent.name}
                    </span>
                    {agent.isBuiltIn && (
                      <Badge variant="secondary" className="text-[10px]">
                        Built-in
                      </Badge>
                    )}
                  </div>
                  {agent.description && (
                    <p className="text-muted-foreground line-clamp-2 text-xs">
                      {agent.description}
                    </p>
                  )}
                </div>
              </label>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {renderGroup("Built-in Agents", builtInAgents)}
      {renderGroup("Custom Leaf Agents", customLeafAgents)}
    </div>
  );
}
