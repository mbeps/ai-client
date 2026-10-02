"use client";

import {
  CheckSquare,
  ChevronDown,
  ChevronRight,
  Search,
  Square,
  SquareTerminal,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { PickerDialog } from "@/components/chat/picker-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/config/routes";
import type { MentionPromptItem } from "@/hooks/chat/use-mention-commands";
import { cn } from "@/lib/utils";
import type { DiscoveredPrompt } from "@/types/mcp/discovered-prompt";
import type { Prompt } from "@/types/prompt/prompt";

interface PromptPickerProps {
  prompts?: Prompt[];
  mcpPrompts?: DiscoveredPrompt[];
  selectedPrompt?: MentionPromptItem | null;
  onSelectPrompt?: (prompt: MentionPromptItem | null) => void;
  selectedPromptIds?: Set<string>;
  onTogglePrompt?: (prompt: MentionPromptItem) => void;
  onSelectAll?: (prompts: MentionPromptItem[]) => void;
  onClearAll?: () => void;
  className?: string;
  maxHeight?: string;
  defaultExpanded?: boolean;
}

interface PromptGroup {
  id: string;
  name: string;
  isInternal: boolean;
  items: MentionPromptItem[];
}

/**
 * Picker list for selecting Slash Command and MCP Prompts.
 *
 * @author Maruf Bepary
 */
export function PromptPicker({
  prompts = [],
  mcpPrompts = [],
  selectedPrompt,
  onSelectPrompt,
  selectedPromptIds,
  onTogglePrompt,
  onSelectAll,
  onClearAll,
  className,
  maxHeight = "350px",
  defaultExpanded = false,
}: PromptPickerProps) {
  const [search, setSearch] = useState("");
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    if (defaultExpanded) {
      initial.add("internal");
      mcpPrompts.forEach((p) => {
        initial.add(p.serverId || p.serverName || "mcp");
      });
    } else if (selectedPromptIds && selectedPromptIds.size > 0) {
      initial.add("internal");
      mcpPrompts.forEach((p) => {
        const sId = p.serverId || p.serverName || "mcp";
        if (selectedPromptIds.has(`mcp:${p.serverId}:${p.name}`)) {
          initial.add(sId);
        }
      });
    } else if (selectedPrompt) {
      if (selectedPrompt.isMcp) {
        const sId =
          ("serverId" in selectedPrompt &&
          typeof selectedPrompt.serverId === "string"
            ? selectedPrompt.serverId
            : "") || selectedPrompt.sourceServer;
        if (sId) initial.add(sId);
      } else {
        initial.add("internal");
      }
    }
    return initial;
  });

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

  const allItems: MentionPromptItem[] = useMemo(() => {
    const localItems: MentionPromptItem[] = prompts.map((p) => ({
      ...p,
      isMcp: false,
      isSkill: false,
    }));

    const mcpItems: MentionPromptItem[] = mcpPrompts.map((p) => ({
      ...p,
      id: `mcp:${p.serverId}:${p.name}`,
      title: p.name,
      shortcut: p.name,
      sourceServer: p.serverName,
      isMcp: true,
      isSkill: false,
    }));

    return [...localItems, ...mcpItems];
  }, [prompts, mcpPrompts]);

  const filteredItems = useMemo(() => {
    const q = search.toLowerCase();
    return allItems.filter((item) => {
      const titleMatch = item.title.toLowerCase().includes(q);
      const shortcutMatch = item.shortcut.toLowerCase().includes(q);
      const contentMatch =
        "content" in item && typeof item.content === "string"
          ? item.content.toLowerCase().includes(q)
          : false;
      const descMatch =
        "description" in item && typeof item.description === "string"
          ? item.description.toLowerCase().includes(q)
          : false;
      const serverMatch =
        "sourceServer" in item && typeof item.sourceServer === "string"
          ? item.sourceServer.toLowerCase().includes(q)
          : false;
      return (
        titleMatch || shortcutMatch || contentMatch || descMatch || serverMatch
      );
    });
  }, [allItems, search]);

  const groups: PromptGroup[] = useMemo(() => {
    const list: PromptGroup[] = [];

    // Internal group
    const internalItems = filteredItems.filter((item) => !item.isMcp);
    if (internalItems.length > 0 || (!search && prompts.length > 0)) {
      list.push({
        id: "internal",
        name: "Internal Prompts",
        isInternal: true,
        items: internalItems,
      });
    }

    // MCP groups
    const mcpServerOrder: string[] = [];
    const mcpServerMap = new Map<
      string,
      { name: string; items: MentionPromptItem[] }
    >();

    mcpPrompts.forEach((p) => {
      const serverId = p.serverId || p.serverName || "mcp";
      if (!mcpServerMap.has(serverId)) {
        mcpServerOrder.push(serverId);
        mcpServerMap.set(serverId, {
          name: p.serverName || "MCP Server",
          items: [],
        });
      }
    });

    filteredItems
      .filter((item) => item.isMcp)
      .forEach((item) => {
        const sId =
          ("serverId" in item && typeof item.serverId === "string"
            ? item.serverId
            : "") ||
          item.sourceServer ||
          "mcp";
        if (!mcpServerMap.has(sId)) {
          mcpServerOrder.push(sId);
          mcpServerMap.set(sId, {
            name: item.sourceServer || "MCP Server",
            items: [],
          });
        }
        mcpServerMap.get(sId)!.items.push(item);
      });

    mcpServerOrder.forEach((serverId) => {
      const data = mcpServerMap.get(serverId);
      if (data && (data.items.length > 0 || !search)) {
        list.push({
          id: serverId,
          name: data.name,
          isInternal: false,
          items: data.items,
        });
      }
    });

    return list;
  }, [filteredItems, search, prompts.length, mcpPrompts]);

  const isAllSelected = useMemo(() => {
    if (filteredItems.length === 0) return false;
    if (selectedPromptIds) {
      return filteredItems.every((item) => selectedPromptIds.has(item.id));
    }
    return selectedPrompt !== null;
  }, [filteredItems, selectedPromptIds, selectedPrompt]);

  const handleToggle = (item: MentionPromptItem) => {
    if (onTogglePrompt) {
      onTogglePrompt(item);
    } else if (onSelectPrompt) {
      if (selectedPrompt?.id === item.id) {
        onSelectPrompt(null);
      } else {
        onSelectPrompt(item);
      }
    }
  };

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
    } else if (onSelectPrompt) {
      if (isAllSelected) {
        onSelectPrompt(null);
      } else if (filteredItems.length > 0) {
        onSelectPrompt(filteredItems[0]);
      }
    }
  };

  const selectedCount = useMemo(() => {
    if (selectedPromptIds) {
      return filteredItems.filter((item) => selectedPromptIds.has(item.id))
        .length;
    }
    return selectedPrompt
      ? filteredItems.some((item) => item.id === selectedPrompt.id)
        ? 1
        : 0
      : 0;
  }, [filteredItems, selectedPromptIds, selectedPrompt]);

  const renderPromptCard = (item: MentionPromptItem) => {
    const isSelected = selectedPromptIds
      ? selectedPromptIds.has(item.id)
      : selectedPrompt?.id === item.id;

    return (
      <div
        key={item.id}
        className={cn(
          "group flex cursor-pointer items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:bg-accent/50",
          isSelected && "border-primary bg-primary/5",
        )}
        onClick={() => handleToggle(item)}
      >
        <div className="pt-0.5">
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => handleToggle(item)}
            onClick={(e) => e.stopPropagation()}
          />
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center justify-between gap-2">
            <span className="truncate font-medium text-sm leading-none">
              {item.title}
            </span>
            {!item.isMcp && "shortcut" in item && item.shortcut && (
              <Badge
                variant="secondary"
                className="h-4 shrink-0 bg-muted px-1 py-0 font-mono text-[10px] text-muted-foreground"
              >
                {item.shortcut.startsWith("/")
                  ? item.shortcut
                  : `/${item.shortcut}`}
              </Badge>
            )}
          </div>
          {"description" in item && item.description ? (
            <p className="line-clamp-2 text-muted-foreground text-xs">
              {item.description}
            </p>
          ) : "content" in item && item.content ? (
            <p className="line-clamp-2 font-mono text-muted-foreground text-xs">
              {item.content}
            </p>
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className={cn("flex min-h-0 flex-1 flex-col gap-3", className)}>
      <div className="relative shrink-0">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search prompts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="flex shrink-0 items-center justify-between px-0.5 text-muted-foreground text-xs">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 gap-1.5 px-2 font-medium text-muted-foreground text-xs hover:text-foreground"
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
            <div className="py-8 text-center text-muted-foreground text-sm">
              {search.length > 0 ? (
                <>No prompts found matching &quot;{search}&quot;</>
              ) : (
                <>No prompts found.</>
              )}
            </div>
          ) : (
            groups.map((group) => {
              const isExpanded =
                expandedGroups.has(group.id) || search.length > 0;
              const selectedInGroup = group.items.filter((item) =>
                selectedPromptIds
                  ? selectedPromptIds.has(item.id)
                  : selectedPrompt?.id === item.id,
              ).length;

              if (group.isInternal) {
                return (
                  <div
                    key={group.id}
                    className="flex flex-col overflow-hidden rounded-lg border border-primary/20"
                  >
                    <div
                      className="flex shrink-0 cursor-pointer items-center justify-between bg-primary/5 p-3 transition-colors hover:bg-primary/10"
                      onClick={() => toggleExpand(group.id)}
                    >
                      <div className="flex items-center gap-3">
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-primary" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-primary" />
                        )}
                        <span className="font-medium text-primary">
                          {group.name}
                        </span>
                        {selectedInGroup > 0 && (
                          <Badge
                            variant="secondary"
                            className="h-4 px-1 text-[10px]"
                          >
                            {selectedInGroup} selected
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <div
                          className="flex items-center"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (selectedInGroup > 0) {
                              onSelectPrompt?.(null);
                            } else if (group.items.length > 0) {
                              onSelectPrompt?.(group.items[0]);
                            }
                          }}
                        >
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
                      <div className="space-y-2 border-primary/20 border-t bg-card/50 p-3">
                        {group.items.map((item) => renderPromptCard(item))}
                      </div>
                    )}
                  </div>
                );
              }

              return (
                <div
                  key={group.id}
                  className="flex flex-col overflow-hidden rounded-lg border"
                >
                  <div
                    className="flex shrink-0 cursor-pointer items-center justify-between bg-muted/30 p-3 transition-colors hover:bg-muted/50"
                    onClick={() => toggleExpand(group.id)}
                  >
                    <div className="flex items-center gap-3">
                      {isExpanded ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      <span className="font-medium">{group.name}</span>
                      {selectedInGroup > 0 && (
                        <Badge
                          variant="secondary"
                          className="h-4 px-1 text-[10px]"
                        >
                          {selectedInGroup} selected
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <div
                        className="flex items-center"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (selectedInGroup > 0) {
                            onSelectPrompt?.(null);
                          } else if (group.items.length > 0) {
                            onSelectPrompt?.(group.items[0]);
                          }
                        }}
                      >
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
                    <div className="space-y-2 border-t bg-card/50 p-3">
                      {group.items.map((item) => renderPromptCard(item))}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

interface PromptPickerDialogProps {
  prompts?: Prompt[];
  mcpPrompts?: DiscoveredPrompt[];
  selectedPrompt?: MentionPromptItem | null;
  onSelectPrompt?: (prompt: MentionPromptItem | null) => void;
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
  selectedPrompt,
  onSelectPrompt,
  selectedPromptIds,
  onTogglePrompt,
  onClearAll,
  trigger,
}: PromptPickerDialogProps) {
  const totalCount = prompts.length + mcpPrompts.length;
  const hasSelection =
    (selectedPromptIds && selectedPromptIds.size > 0) ||
    Boolean(selectedPrompt);

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
              onSelectPrompt?.(null);
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
        selectedPrompt={selectedPrompt}
        onSelectPrompt={onSelectPrompt}
        selectedPromptIds={selectedPromptIds}
        onTogglePrompt={onTogglePrompt}
        onClearAll={onClearAll}
        className="flex min-h-0 flex-1 flex-col p-4"
      />
    </PickerDialog>
  );
}
