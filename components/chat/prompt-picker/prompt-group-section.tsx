"use client";

import { ChevronDown, ChevronRight } from "lucide-react";
import type React from "react";
import type { PromptGroup } from "@/components/chat/prompt-picker/prompt-picker-utils";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import type { MentionPromptItem } from "@/hooks/chat/use-mention-commands";
import { cn } from "@/lib/utils";

/**
 * Props for an individual prompt card item.
 *
 * @author Maruf Bepary
 */
export interface PromptCardItemProps {
  /** The prompt item data. */
  item: MentionPromptItem;
  /** Whether this prompt is currently checked. */
  isSelected: boolean;
  /** Callback invoked when the user toggles selection. */
  onToggle: (item: MentionPromptItem) => void;
}

/**
 * Renders an individual selectable prompt card with title, shortcut badge, and description.
 *
 * @param props - Card properties and callbacks.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
export function PromptCardItem({
  item,
  isSelected,
  onToggle,
}: PromptCardItemProps) {
  return (
    <div
      className={cn(
        "group bg-card hover:bg-accent/50 flex cursor-pointer items-start gap-3 rounded-lg border p-3 transition-colors",
        isSelected && "border-primary bg-primary/5",
      )}
      onClick={() => onToggle(item)}
    >
      <div className="pt-0.5">
        <Checkbox
          checked={isSelected}
          onCheckedChange={() => onToggle(item)}
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-sm leading-none font-medium">
            {item.title}
          </span>
          {!item.isMcp && "shortcut" in item && item.shortcut && (
            <Badge
              variant="secondary"
              className="bg-muted text-muted-foreground h-4 shrink-0 px-1 py-0 font-mono text-[10px]"
            >
              {item.shortcut.startsWith("/")
                ? item.shortcut
                : `/${item.shortcut}`}
            </Badge>
          )}
        </div>
        {"description" in item && item.description ? (
          <p className="text-muted-foreground line-clamp-2 text-xs">
            {item.description}
          </p>
        ) : "content" in item && item.content ? (
          <p className="text-muted-foreground line-clamp-2 font-mono text-xs">
            {item.content}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/**
 * Props for the collapsible prompt group section.
 *
 * @author Maruf Bepary
 */
export interface PromptGroupSectionProps {
  /** Group metadata and child prompt items. */
  group: PromptGroup;
  /** Whether this group accordion is currently open. */
  isExpanded: boolean;
  /** Set of active selected prompt IDs. */
  selectedPromptIds?: Set<string>;
  /** Callback to toggle accordion expansion. */
  onToggleExpand: (groupId: string) => void;
  /** Callback to toggle an individual prompt item. */
  onTogglePrompt?: (prompt: MentionPromptItem) => void;
  /** Optional bulk toggle callback for the whole group. */
  onBulkToggleGroup?: (group: PromptGroup, select: boolean) => void;
}

/**
 * Renders a collapsible prompt group accordion with select-all header and child cards.
 *
 * @param props - Section properties and action handlers.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
export function PromptGroupSection({
  group,
  isExpanded,
  selectedPromptIds,
  onToggleExpand,
  onTogglePrompt,
  onBulkToggleGroup,
}: PromptGroupSectionProps) {
  const selectedInGroup = group.items.filter((item) =>
    selectedPromptIds?.has(item.id),
  ).length;

  const handleGroupCheckboxClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (onBulkToggleGroup) {
      onBulkToggleGroup(group, selectedInGroup === 0);
    } else if (onTogglePrompt) {
      if (selectedInGroup > 0) {
        group.items.forEach((item) => {
          if (selectedPromptIds?.has(item.id)) onTogglePrompt(item);
        });
      } else {
        group.items.forEach((item) => {
          if (!selectedPromptIds?.has(item.id)) onTogglePrompt(item);
        });
      }
    }
  };

  const isInternal = group.isInternal;

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border",
        isInternal ? "border-primary/20" : "border-border",
      )}
    >
      <div
        className={cn(
          "flex shrink-0 cursor-pointer items-center justify-between p-3 transition-colors",
          isInternal
            ? "bg-primary/5 hover:bg-primary/10"
            : "bg-muted/30 hover:bg-muted/50",
        )}
        onClick={() => onToggleExpand(group.id)}
      >
        <div className="flex items-center gap-3">
          {isExpanded ? (
            <ChevronDown
              className={cn("h-4 w-4", isInternal && "text-primary")}
            />
          ) : (
            <ChevronRight
              className={cn("h-4 w-4", isInternal && "text-primary")}
            />
          )}
          <span className={cn("font-medium", isInternal && "text-primary")}>
            {group.name}
          </span>
          {selectedInGroup > 0 && (
            <Badge variant="secondary" className="h-4 px-1 text-[10px]">
              {selectedInGroup} selected
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center" onClick={handleGroupCheckboxClick}>
            <Checkbox
              checked={selectedInGroup > 0}
              disabled={group.items.length === 0}
              aria-label={`Select all from ${group.name}`}
              className="h-4 w-4"
            />
          </div>
        </div>
      </div>

      {isExpanded && (
        <div
          className={cn(
            "bg-card/50 space-y-2 border-t p-3",
            isInternal && "border-primary/20",
          )}
        >
          {group.items.map((item) => (
            <PromptCardItem
              key={item.id}
              item={item}
              isSelected={selectedPromptIds?.has(item.id) ?? false}
              onToggle={(toggled) => onTogglePrompt?.(toggled)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
