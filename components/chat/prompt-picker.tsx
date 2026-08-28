"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { Prompt } from "@/types/prompt/prompt";
import type { DiscoveredPrompt } from "@/types/mcp/discovered-prompt";
import type { MentionPromptItem } from "@/hooks/chat/use-mention-commands";
import { SquareTerminal, Zap, Search, Check, X } from "lucide-react";
import { useState, useMemo } from "react";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { ROUTES } from "@/constants/routes";

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
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
            <div className="text-center py-8 text-muted-foreground text-sm">
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
                    "flex items-start gap-3 p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer group",
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
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        {isMcp ? (
                          <Zap className="h-4 w-4 text-amber-500 shrink-0" />
                        ) : (
                          <SquareTerminal className="h-4 w-4 text-muted-foreground shrink-0" />
                        )}
                        <span className="font-medium text-sm leading-none truncate">
                          {item.title}
                        </span>
                      </div>
                      {isMcp ? (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1 py-0 h-4 max-w-[100px] truncate font-normal shrink-0"
                        >
                          {item.sourceServer}
                        </Badge>
                      ) : (
                        <Badge
                          variant="secondary"
                          className="text-[10px] px-1 py-0 h-4 bg-muted text-muted-foreground shrink-0 font-mono"
                        >
                          {item.shortcut.startsWith("/")
                            ? item.shortcut
                            : `/${item.shortcut}`}
                        </Badge>
                      )}
                    </div>
                    {"description" in item && item.description ? (
                      <p className="text-xs text-muted-foreground line-clamp-2">
                        {item.description}
                      </p>
                    ) : "content" in item && item.content ? (
                      <p className="text-xs text-muted-foreground line-clamp-2 font-mono">
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
        {trigger || <Button>Select Prompt</Button>}
      </DialogTrigger>
      <DialogContent className="max-w-md flex flex-col p-0 overflow-hidden">
        <DialogHeader className="px-4 pt-4 pb-3 border-b">
          <DialogTitle>Select Prompt</DialogTitle>
          <DialogDescription className="sr-only">
            Choose a prompt to use in your message
          </DialogDescription>
        </DialogHeader>

        {totalCount === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-muted-foreground">
            <SquareTerminal className="h-8 w-8 mx-auto mb-3 opacity-40" />
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

            <div className="px-4 py-3 border-t flex items-center justify-between bg-muted/20 shrink-0">
              <p className="text-xs text-muted-foreground">
                <strong>{selectedPrompt ? 1 : 0}</strong> prompt selected
              </p>
              <div className="flex items-center gap-2">
                {selectedPrompt && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onSelectPrompt(null)}
                    className="text-xs h-8"
                  >
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
