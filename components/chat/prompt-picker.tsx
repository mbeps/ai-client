"use client";

import {
  Check,
  CheckSquare,
  ChevronDown,
  ChevronRight,
  ExternalLink,
  Search,
  Square,
  SquareTerminal,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
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
  onSelectPrompt: (prompt: MentionPromptItem | null) => void;
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

  const isAllSelected = selectedPrompt !== null;

  const handleToggle = (item: MentionPromptItem) => {
    if (selectedPrompt?.id === item.id) {
      onSelectPrompt(null);
    } else {
      onSelectPrompt(item);
    }
  };

  const handleToggleAll = () => {
    if (isAllSelected) {
      onSelectPrompt(null);
    } else if (filteredItems.length > 0) {
      onSelectPrompt(filteredItems[0]);
    }
  };

  const isSelectedInView = useMemo(() => {
    return selectedPrompt
      ? filteredItems.some((item) => item.id === selectedPrompt.id)
      : false;
  }, [selectedPrompt, filteredItems]);
  const selectedCount = isSelectedInView ? 1 : 0;

  const renderPromptCard = (item: MentionPromptItem) => {
    const isSelected = selectedPrompt?.id === item.id;

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
              const selectedInGroup = group.items.filter(
                (item) => selectedPrompt?.id === item.id,
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
                              onSelectPrompt(null);
                            } else if (group.items.length > 0) {
                              onSelectPrompt(group.items[0]);
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
                            onSelectPrompt(null);
                          } else if (group.items.length > 0) {
                            onSelectPrompt(group.items[0]);
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
  onSelectPrompt: (prompt: MentionPromptItem | null) => void;
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
  trigger,
}: PromptPickerDialogProps) {
  const [open, setOpen] = useState(false);

  const totalCount = prompts.length + mcpPrompts.length;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger || (
          <Button>
            <SquareTerminal className="mr-2 h-4 w-4" />
            Select Prompt
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="flex max-h-[80vh] flex-col overflow-hidden p-0 sm:max-h-[600px] sm:max-w-lg">
        <DialogHeader className="border-b px-4 py-3.5 pr-12">
          <DialogTitle className="font-semibold text-base">
            Select Prompt
          </DialogTitle>
          <DialogDescription className="sr-only">
            Choose a prompt to use in your message
          </DialogDescription>
        </DialogHeader>

        {totalCount === 0 ? (
          <div className="px-4 py-8 text-center text-muted-foreground text-sm">
            <SquareTerminal className="mx-auto mb-3 h-8 w-8 opacity-40" />
            <p className="mb-2">No prompts configured yet.</p>
            <Link
              href={ROUTES.SETTINGS.PROMPTS.path}
              className="text-primary underline underline-offset-4"
              onClick={() => setOpen(false)}
            >
              Create a prompt in Settings
            </Link>
          </div>
        ) : (
          <>
            <PromptPicker
              prompts={prompts}
              mcpPrompts={mcpPrompts}
              selectedPrompt={selectedPrompt}
              onSelectPrompt={onSelectPrompt}
              className="flex min-h-0 flex-1 flex-col p-4"
            />

            <div className="flex shrink-0 items-center justify-between border-t bg-muted/20 px-4 py-3">
              <Button
                variant="outline"
                size="sm"
                asChild
                className="h-8 gap-1.5 text-muted-foreground text-xs hover:text-foreground"
              >
                <Link
                  href={ROUTES.SETTINGS.PROMPTS.path}
                  onClick={() => setOpen(false)}
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  <span>Manage Prompts</span>
                </Link>
              </Button>
              <div className="flex items-center gap-2">
                {selectedPrompt && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSelectPrompt(null)}
                    className="h-8 text-xs"
                  >
                    <X className="mr-1 h-3.5 w-3.5" />
                    Clear
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOpen(false)}
                  className="gap-2"
                >
                  <X className="h-4 w-4" />
                  Cancel
                </Button>
                <Button
                  size="sm"
                  onClick={() => setOpen(false)}
                  className="gap-2 px-6"
                >
                  <Check className="h-4 w-4" />
                  Done
                </Button>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
