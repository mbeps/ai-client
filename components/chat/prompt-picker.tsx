"use client";

import { CheckSquare, Search, Square, SquareTerminal, X } from "lucide-react";
import type React from "react";
import { useMemo, useState } from "react";
import { PickerDialog } from "@/components/chat/picker-dialog";
import { PromptGroupSection } from "@/components/chat/prompt-picker/prompt-group-section";
import {
  buildPromptItems,
  filterPromptsByQuery,
  groupPromptsByCategory,
  resolveInitialExpandedGroups,
} from "@/components/chat/prompt-picker/prompt-picker-utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/config/routes";
import type { MentionPromptItem } from "@/hooks/chat/use-mention-commands";
import { cn } from "@/lib/utils";
import type { DiscoveredPrompt } from "@/types/mcp/discovered-prompt";
import type { Prompt } from "@/types/prompt/prompt";

/**
 * Represents prompt picker props.
 *
 * @author Maruf Bepary
 */
export interface PromptPickerProps {
  prompts?: Prompt[];
  mcpPrompts?: DiscoveredPrompt[];
  selectedPromptIds?: Set<string>;
  onTogglePrompt?: (prompt: MentionPromptItem) => void;
  onSelectAll?: (prompts: MentionPromptItem[]) => void;
  onClearAll?: () => void;
  className?: string;
  maxHeight?: string;
  defaultExpanded?: boolean;
}

/**
 * Picker list for selecting Slash Command and MCP Prompts.
 *
 * @author Maruf Bepary
 */
export function PromptPicker({
  prompts = [],
  mcpPrompts = [],
  selectedPromptIds,
  onTogglePrompt,
  onSelectAll,
  onClearAll,
  className,
  maxHeight = "350px",
  defaultExpanded = false,
}: PromptPickerProps) {
  const [search, setSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() =>
    resolveInitialExpandedGroups(
      defaultExpanded,
      selectedPromptIds,
      mcpPrompts,
    ),
  );

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

  const allItems = useMemo(
    () => buildPromptItems(prompts, mcpPrompts),
    [prompts, mcpPrompts],
  );

  const filteredItems = useMemo(
    () => filterPromptsByQuery(allItems, search),
    [allItems, search],
  );

  const groups = useMemo(
    () =>
      groupPromptsByCategory(
        filteredItems,
        mcpPrompts,
        Boolean(search.length > 0),
        prompts.length > 0,
      ),
    [filteredItems, search, prompts.length, mcpPrompts],
  );

  const isAllSelected = useMemo(() => {
    if (filteredItems.length === 0) return false;
    if (selectedPromptIds) {
      return filteredItems.every((item) => selectedPromptIds.has(item.id));
    }
    return false;
  }, [filteredItems, selectedPromptIds]);

  const handleToggleAll = () => {
    if (onSelectAll && onClearAll) {
      if (isAllSelected) {
        onClearAll();
      } else {
        onSelectAll(filteredItems);
      }
    } else if (onTogglePrompt && selectedPromptIds) {
      if (isAllSelected) {
        filteredItems.forEach((item) => {
          if (selectedPromptIds.has(item.id)) onTogglePrompt(item);
        });
      } else {
        filteredItems.forEach((item) => {
          if (!selectedPromptIds.has(item.id)) onTogglePrompt(item);
        });
      }
    }
  };

  const selectedCount = useMemo(() => {
    if (selectedPromptIds) {
      return filteredItems.filter((item) => selectedPromptIds.has(item.id))
        .length;
    }
    return 0;
  }, [filteredItems, selectedPromptIds]);

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-3", className)}>
      <div className="relative shrink-0">
        <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
        <Input
          placeholder="Search prompts..."
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
          onClick={handleToggleAll}
          disabled={filteredItems.length === 0}
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
            ? `${selectedCount}/${filteredItems.length} selected ${filteredItems.length === 1 ? "prompt" : "prompts"}`
            : `${filteredItems.length} ${filteredItems.length === 1 ? "prompt" : "prompts"} available`}
        </span>
      </div>

      <div
        className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-1"
        style={maxHeight ? { maxHeight } : undefined}
      >
        <div className="space-y-4">
          {filteredItems.length === 0 ? (
            <div className="text-muted-foreground py-8 text-center text-sm">
              {search.length > 0 ? (
                <>No prompts found matching &quot;{search}&quot;</>
              ) : (
                <>No prompts found.</>
              )}
            </div>
          ) : (
            groups.map((group) => (
              <PromptGroupSection
                key={group.id}
                group={group}
                isExpanded={expandedGroups.has(group.id) || search.length > 0}
                selectedPromptIds={selectedPromptIds}
                onToggleExpand={toggleExpand}
                onTogglePrompt={onTogglePrompt}
              />
            ))
          )}
        </div>
      </div>
    </div>
  );
}

/**
 * Represents prompt picker dialog props.
 *
 * @author Maruf Bepary
 */
export interface PromptPickerDialogProps {
  prompts?: Prompt[];
  mcpPrompts?: DiscoveredPrompt[];
  selectedPromptIds?: Set<string>;
  onTogglePrompt?: (prompt: MentionPromptItem) => void;
  onClearAll?: () => void;
  trigger?: React.ReactNode;
}

/**
 * Dialog wrapper for PromptPicker.
 *
 * @author Maruf Bepary
 */
export function PromptPickerDialog({
  prompts = [],
  mcpPrompts = [],
  selectedPromptIds,
  onTogglePrompt,
  onClearAll,
  trigger,
}: PromptPickerDialogProps) {
  const totalCount = prompts.length + mcpPrompts.length;
  const hasSelection = selectedPromptIds && selectedPromptIds.size > 0;

  return (
    <PickerDialog
      title="Select Prompt"
      description="Choose a prompt to use in your message"
      trigger={
        trigger || (
          <Button>
            <SquareTerminal className="mr-2 h-4 w-4" />
            Select Prompt
          </Button>
        )
      }
      isEmpty={totalCount === 0}
      emptyIcon={SquareTerminal}
      emptyTitle="No prompts configured yet."
      emptyAction={{
        label: "Create a prompt in Settings",
        href: ROUTES.SETTINGS.PROMPTS.path,
      }}
      manageAction={{
        label: "Manage Prompts",
        href: ROUTES.SETTINGS.PROMPTS.path,
      }}
      extraActions={
        hasSelection ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              onClearAll?.();
            }}
            className="h-8 text-xs"
          >
            <X className="mr-1 h-3.5 w-3.5" />
            Clear
          </Button>
        ) : undefined
      }
    >
      <PromptPicker
        prompts={prompts}
        mcpPrompts={mcpPrompts}
        selectedPromptIds={selectedPromptIds}
        onTogglePrompt={onTogglePrompt}
        onClearAll={onClearAll}
        className="flex min-h-0 flex-1 flex-col p-4"
      />
    </PickerDialog>
  );
}
