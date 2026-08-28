"use client";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { Assistant } from "@/types/assistant/assistant";
import { cn } from "@/lib/utils";
import {
  type MentionTrigger,
  type MentionItem,
  isSkillItem,
  isPromptItem,
  isAssistantItem,
} from "@/hooks/chat/use-mention-commands";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bot, Zap, SquareTerminal, BrainCircuit } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
        "z-50 w-[380px] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95",
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
                      "flex items-center gap-2 py-2 px-3",
                      itemIndex === selectedIndex &&
                        "bg-accent text-accent-foreground",
                    )}
                  >
                    <BrainCircuit className="h-4 w-4 text-primary shrink-0" />
                    <div className="flex items-center justify-between w-full overflow-hidden">
                      <span className="font-medium truncate">
                        {item.displayName || item.name}
                      </span>
                      <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded font-mono shrink-0 ml-2">
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
                      "flex items-center gap-2 py-2 px-3",
                      itemIndex === selectedIndex &&
                        "bg-accent text-accent-foreground",
                    )}
                  >
                    {isMcp ? (
                      <Zap className="h-4 w-4 text-amber-500 shrink-0" />
                    ) : (
                      <SquareTerminal className="h-4 w-4 text-muted-foreground shrink-0" />
                    )}

                    <div className="flex items-center justify-between w-full overflow-hidden">
                      <span className="font-medium truncate">
                        {isMcp ? (item as any).name : (item as any).title}
                      </span>
                      {!isMcp && (
                        <span className="text-[10px] text-muted-foreground uppercase bg-muted px-1.5 py-0.5 rounded ml-2 shrink-0">
                          {(item as any).shortcut.startsWith("/")
                            ? (item as any).shortcut
                            : `/${(item as any).shortcut}`}
                        </span>
                      )}
                      {isMcp && (
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1 py-0 h-4 ml-2 max-w-[100px] truncate font-normal"
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
                      "flex items-center gap-2 py-2 px-3",
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

                    <div className="flex flex-col w-full overflow-hidden">
                      <span className="font-medium truncate">
                        {(item as Assistant).name}
                      </span>
                      {(item as Assistant).description && (
                        <span className="text-xs text-muted-foreground truncate">
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
