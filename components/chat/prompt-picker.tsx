"use client";

import { Check, Search, SquareTerminal, X, Zap } from "lucide-react";
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
import { ScrollArea } from "@/components/ui/scroll-area";
import { ROUTES } from "@/constants/routes";
import type { MentionPromptItem } from "@/hooks/chat/use-mention-commands";
import { cn } from "@/lib/utils";
import type { DiscoveredPrompt } from "@/types/mcp/discovered-prompt";
import type { Prompt } from "@/types/prompt/prompt";

interface PromptPickerProps {
  prompts: Prompt[];
  mcpPrompts?: DiscoveredPrompt[];
  selectedPrompt?: MentionPromptItem | null;
  onSelectPrompt: (prompt: MentionPromptItem | null) => void;
  className?: string;
  maxHeight?: string;
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
}: PromptPickerProps) {
  const [search, setSearch] = useState("");

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

  const handleToggle = (item: MentionPromptItem) => {
    if (selectedPrompt?.id === item.id) {
      onSelectPrompt(null);
    } else {
      onSelectPrompt(item);
    }
  };

  return (
    <div className={cn("space-y-4", className)}>
      <div className="relative">
        <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search prompts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <ScrollArea className="pr-4" style={{ maxHeight }}>
        <div className="space-y-2">
          {filteredItems.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No prompts found.
            </div>
          ) : (
            filteredItems.map((item) => {
              const isSelected = selectedPrompt?.id === item.id;
              const isMcp = item.isMcp;

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
                      <div className="flex items-center gap-2">
                        {isMcp ? (
                          <Zap className="h-4 w-4 shrink-0 text-amber-500" />
                        ) : (
                          <SquareTerminal className="h-4 w-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="truncate font-medium text-sm leading-none">
                          {item.title}
                        </span>
                      </div>
                      {isMcp ? (
                        <Badge
                          variant="outline"
                          className="h-4 max-w-[100px] shrink-0 truncate px-1 py-0 font-normal text-[10px]"
                        >
                          {item.sourceServer}
                        </Badge>
                      ) : (
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
            })
          )}
        </div>
      </ScrollArea>
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
      <DialogContent className="flex max-w-md flex-col overflow-hidden p-0">
        <DialogHeader className="border-b px-4 pt-4 pb-3">
          <DialogTitle>Select Prompt</DialogTitle>
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
              className="p-4"
              maxHeight="320px"
            />

            <div className="flex shrink-0 items-center justify-between border-t bg-muted/20 px-4 py-3">
              <p className="text-muted-foreground text-xs">
                <strong>{selectedPrompt ? 1 : 0}</strong> prompt selected
              </p>
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
