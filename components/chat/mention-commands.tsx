"use client";

import { Bot, BrainCircuit, SquareTerminal, Zap } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  isAssistantItem,
  isPromptItem,
  isSkillItem,
  type MentionItem,
  type MentionTrigger,
} from "@/hooks/chat/use-mention-commands";
import { cn } from "@/lib/utils";
import type { Assistant } from "@/types/assistant/assistant";

interface MentionCommandsProps {
  items: MentionItem[];
  trigger: MentionTrigger;
  selectedIndex: number;
  onSelect: (item: MentionItem) => void;
  onClose: () => void;
  className?: string;
}

/**
 * Dropdown menu for mention commands (prompts & skills via `/` and assistants via `@`).
 * Separates Skills into their own distinct group from Prompts.
 *
 * @author Maruf Bepary
 */
export function MentionCommands({
  items,
  trigger,
  selectedIndex,
  onSelect,
  className,
}: MentionCommandsProps) {
  if (!trigger) return null;

  const skillItems = items.filter(isSkillItem);
  const promptItems = items.filter(isPromptItem);
  const assistantItems = items.filter(isAssistantItem);

  return (
    <div
      className={cn(
        "fade-in-0 zoom-in-95 z-50 w-[380px] animate-in overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md",
        className,
      )}
    >
      <Command className="h-auto" value={items[selectedIndex]?.id}>
        <CommandList className="max-h-[300px]">
          <CommandEmpty>
            No {trigger === "/" ? "skills or prompts" : "assistants"} found.
          </CommandEmpty>

          {trigger === "/" && skillItems.length > 0 && (
            <CommandGroup heading="Skills">
              {skillItems.map((item) => {
                const itemIndex = items.indexOf(item);
                return (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={() => onSelect(item)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2",
                      itemIndex === selectedIndex &&
                        "bg-accent text-accent-foreground",
                    )}
                  >
                    <BrainCircuit className="h-4 w-4 shrink-0 text-primary" />
                    <div className="flex w-full items-center justify-between overflow-hidden">
                      <span className="truncate font-medium">
                        {item.displayName || item.name}
                      </span>
                      <span className="ml-2 shrink-0 rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                        /{item.name}
                      </span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          {trigger === "/" && promptItems.length > 0 && (
            <CommandGroup heading="Prompts">
              {promptItems.map((item) => {
                const itemIndex = items.indexOf(item);
                const isMcp = "isMcp" in item && item.isMcp;

                return (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={() => onSelect(item)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2",
                      itemIndex === selectedIndex &&
                        "bg-accent text-accent-foreground",
                    )}
                  >
                    {isMcp ? (
                      <Zap className="h-4 w-4 shrink-0 text-amber-500" />
                    ) : (
                      <SquareTerminal className="h-4 w-4 shrink-0 text-muted-foreground" />
                    )}

                    <div className="flex w-full items-center justify-between overflow-hidden">
                      <span className="truncate font-medium">
                        {isMcp ? (item as any).name : (item as any).title}
                      </span>
                      {!isMcp && (
                        <span className="ml-2 shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground uppercase">
                          {(item as any).shortcut.startsWith("/")
                            ? (item as any).shortcut
                            : `/${(item as any).shortcut}`}
                        </span>
                      )}
                      {isMcp && (
                        <Badge
                          variant="outline"
                          className="ml-2 h-4 max-w-[100px] truncate px-1 py-0 font-normal text-[10px]"
                        >
                          {(item as any).sourceServer}
                        </Badge>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          {trigger === "@" && assistantItems.length > 0 && (
            <CommandGroup heading="Assistants">
              {assistantItems.map((item) => {
                const itemIndex = items.indexOf(item);
                return (
                  <CommandItem
                    key={item.id}
                    value={item.id}
                    onSelect={() => onSelect(item)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2",
                      itemIndex === selectedIndex &&
                        "bg-accent text-accent-foreground",
                    )}
                  >
                    <Avatar className="h-6 w-6 shrink-0">
                      <AvatarImage
                        src={(item as Assistant).avatar ?? undefined}
                      />
                      <AvatarFallback>
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>

                    <div className="flex w-full flex-col overflow-hidden">
                      <span className="truncate font-medium">
                        {(item as Assistant).name}
                      </span>
                      {(item as Assistant).description && (
                        <span className="truncate text-muted-foreground text-xs">
                          {(item as Assistant).description}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}
        </CommandList>
      </Command>
    </div>
  );
}
