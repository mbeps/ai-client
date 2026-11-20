"use client";

import { CheckSquare, Search, Square } from "lucide-react";
import { useMemo, useState } from "react";
import {
  type SubagentGroup,
  SubagentGroupSection,
} from "@/components/shared/subagent-picker/subagent-group-section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types/agent/agent";

/**
 * Props for the SubagentPicker component.
 */
export interface SubagentPickerProps {
  agents: readonly Agent[];
  selectedIds: string[];
  onToggle: (agentId: string) => void;
  onSelectIds?: (agentIds: string[]) => void;
  excludeAgentId?: string;
  disabled?: boolean;
  emptyMessage?: string;
  defaultExpanded?: boolean;
  columns?: 1 | 2;
  className?: string;
  maxHeight?: string;
}

/**
 * Multi-select picker of eligible Leaf Agents (custom leaf agents + linkable built-in agents).
 * Excludes orchestrator agents (2-layer invariant), `builtin:kb-reader`, and `excludeAgentId`.
 */
export function SubagentPicker({
  agents,
  selectedIds,
  onToggle,
  onSelectIds,
  excludeAgentId,
  disabled = false,
  emptyMessage = "No eligible leaf agents available.",
  defaultExpanded = true,
  columns = 2,
  className,
  maxHeight,
}: SubagentPickerProps) {
  const [search, setSearch] = useState("");
  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const eligible = useMemo(
    () =>
      agents.filter(
        (a) =>
          !a.isOrchestrator &&
          a.subagentIds.length === 0 &&
          a.id !== excludeAgentId &&
          a.id !== "builtin:kb-reader",
      ),
    [agents, excludeAgentId],
  );

  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (defaultExpanded) {
      initial.add("builtin");
      initial.add("custom");
    }
    return initial;
  });

  const normalizedSearch = search.trim().toLowerCase();
  const filteredEligible = useMemo(() => {
    if (!normalizedSearch) return eligible;
    return eligible.filter(
      (a) =>
        a.name.toLowerCase().includes(normalizedSearch) ||
        (a.description?.toLowerCase().includes(normalizedSearch) ?? false),
    );
  }, [eligible, normalizedSearch]);

  const groups = useMemo<SubagentGroup[]>(() => {
    const builtIn = filteredEligible.filter((a) => a.isBuiltIn);
    const custom = filteredEligible.filter((a) => !a.isBuiltIn);
    const result: SubagentGroup[] = [];
    if (builtIn.length > 0) {
      result.push({
        id: "builtin",
        name: "Built-in Agents",
        isBuiltIn: true,
        items: builtIn,
      });
    }
    if (custom.length > 0) {
      result.push({
        id: "custom",
        name: "Custom Agents",
        isBuiltIn: false,
        items: custom,
      });
    }
    return result;
  }, [filteredEligible]);

  if (eligible.length === 0) {
    return (
      <p className="text-muted-foreground rounded-lg border border-dashed p-4 text-center text-sm">
        {emptyMessage}
      </p>
    );
  }

  const toggleExpand = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  const applyBulkSelection = (targetIds: string[], select: boolean) => {
    if (disabled) return;
    if (onSelectIds) {
      const targetSet = new Set(targetIds);
      const nextIds = select
        ? Array.from(new Set([...selectedIds, ...targetIds]))
        : selectedIds.filter((id) => !targetSet.has(id));
      onSelectIds(nextIds);
      return;
    }

    for (const id of targetIds) {
      const isSelected = selectedSet.has(id);
      if (select && !isSelected) onToggle(id);
      if (!select && isSelected) onToggle(id);
    }
  };

  const selectedCount = filteredEligible.filter((a) =>
    selectedSet.has(a.id),
  ).length;
  const isAllSelected =
    filteredEligible.length > 0 && selectedCount === filteredEligible.length;

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-3", className)}>
      <div className="relative shrink-0">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder="Search subagents..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="text-muted-foreground flex shrink-0 items-center justify-between px-0.5 text-xs">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="text-muted-foreground hover:text-foreground h-7 gap-1.5 px-2 text-xs font-medium"
          onClick={() =>
            applyBulkSelection(
              filteredEligible.map((a) => a.id),
              !isAllSelected,
            )
          }
          disabled={disabled || filteredEligible.length === 0}
        >
          {isAllSelected ? (
            <Square className="h-3.5 w-3.5" />
          ) : (
            <CheckSquare className="h-3.5 w-3.5" />
          )}
          <span>{isAllSelected ? "Deselect All" : "Select All"}</span>
        </Button>
        <span>
          {selectedCount > 0
            ? `${selectedCount}/${filteredEligible.length} selected ${filteredEligible.length === 1 ? "subagent" : "subagents"}`
            : `${filteredEligible.length} ${filteredEligible.length === 1 ? "subagent" : "subagents"} available`}
        </span>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1"
        style={maxHeight ? { maxHeight } : undefined}
      >
        {filteredEligible.length === 0 ? (
          <div className="text-muted-foreground py-8 text-center text-sm">
            No subagents found matching &quot;{search}&quot;
          </div>
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <SubagentGroupSection
                key={group.id}
                group={group}
                isExpanded={
                  expandedGroups.has(group.id) || normalizedSearch.length > 0
                }
                selectedSet={selectedSet}
                disabled={disabled}
                columns={columns}
                onToggleExpand={toggleExpand}
                onToggleAgent={onToggle}
                onBulkSelect={applyBulkSelection}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
