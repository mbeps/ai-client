"use client";

import { Bot, ChevronDown, ChevronRight, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types/agent/agent";

export interface SubagentGroup {
  id: "builtin" | "custom";
  name: string;
  isBuiltIn: boolean;
  items: Agent[];
}

interface SubagentCardItemProps {
  agent: Agent;
  checked: boolean;
  disabled: boolean;
  onToggle: (agentId: string) => void;
}

/**
 * Renders a single selectable agent card inside a subagent group.
 */
function SubagentCardItem({
  agent,
  checked,
  disabled,
  onToggle,
}: SubagentCardItemProps) {
  return (
    <label
      className={cn(
        "flex items-start gap-3 rounded-lg border p-3 transition-colors",
        checked ? "border-primary bg-primary/5" : "hover:bg-muted/50",
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer",
      )}
    >
      <Checkbox
        checked={checked}
        disabled={disabled}
        aria-label={agent.name}
        onCheckedChange={() => onToggle(agent.id)}
        className="mt-0.5"
      />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2">
          {agent.isBuiltIn ? (
            <ShieldCheck className="text-primary h-4 w-4 shrink-0" />
          ) : (
            <Bot className="text-primary h-4 w-4 shrink-0" />
          )}
          <span className="truncate text-sm font-medium">{agent.name}</span>
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
}

export interface SubagentGroupSectionProps {
  group: SubagentGroup;
  isExpanded: boolean;
  selectedSet: Set<string>;
  disabled: boolean;
  columns?: 1 | 2;
  onToggleExpand: (groupId: string) => void;
  onToggleAgent: (agentId: string) => void;
  onBulkSelect: (targetIds: string[], select: boolean) => void;
}

/**
 * Renders a collapsible accordion section for Built-in or Custom subagents.
 */
export function SubagentGroupSection({
  group,
  isExpanded,
  selectedSet,
  disabled,
  columns = 2,
  onToggleExpand,
  onToggleAgent,
  onBulkSelect,
}: SubagentGroupSectionProps) {
  const selectedInGroup = group.items.filter((a) =>
    selectedSet.has(a.id),
  ).length;
  const isAllInGroupSelected =
    group.items.length > 0 && selectedInGroup === group.items.length;

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border",
        group.isBuiltIn ? "border-primary/20" : "border-border",
      )}
    >
      <div
        className={cn(
          "flex shrink-0 cursor-pointer items-center justify-between p-3 transition-colors",
          group.isBuiltIn
            ? "bg-primary/5 hover:bg-primary/10"
            : "bg-muted/30 hover:bg-muted/50",
        )}
        onClick={() => onToggleExpand(group.id)}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown
              className={cn("h-4 w-4", group.isBuiltIn && "text-primary")}
            />
          ) : (
            <ChevronRight
              className={cn("h-4 w-4", group.isBuiltIn && "text-primary")}
            />
          )}
          <span
            className={cn(
              "text-sm font-medium",
              group.isBuiltIn && "text-primary",
            )}
          >
            {group.name}
          </span>
          {selectedInGroup > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">
              {selectedInGroup} selected
            </Badge>
          )}
        </div>
        <div className="flex items-center" onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={isAllInGroupSelected}
            disabled={disabled || group.items.length === 0}
            aria-label={`Select all ${group.name}`}
            className="h-4 w-4"
            onCheckedChange={() =>
              onBulkSelect(
                group.items.map((a) => a.id),
                !isAllInGroupSelected,
              )
            }
          />
        </div>
      </div>

      {isExpanded && (
        <div
          className={cn(
            "bg-card/50 grid grid-cols-1 gap-2 border-t p-3",
            columns === 2 && "sm:grid-cols-2",
            group.isBuiltIn && "border-primary/20",
          )}
        >
          {group.items.map((agent) => (
            <SubagentCardItem
              key={agent.id}
              agent={agent}
              checked={selectedSet.has(agent.id)}
              disabled={disabled}
              onToggle={onToggleAgent}
            />
          ))}
        </div>
      )}
    </div>
  );
}
