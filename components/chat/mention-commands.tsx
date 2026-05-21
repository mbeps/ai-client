"use client";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import type { Prompt } from "@/types/prompt";
import type { Assistant } from "@/types/assistant";
import { cn } from "@/lib/utils";
import type { MentionTrigger } from "@/hooks/chat/use-mention-commands";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bot } from "lucide-react";

interface MentionCommandsProps {
  items: (Prompt | Assistant)[];
  trigger: MentionTrigger;
  selectedIndex: number;
  onSelect: (item: Prompt | Assistant) => void;
  onClose: () => void;
  className?: string;
}

export function MentionCommands({
  items,
  trigger,
  selectedIndex,
  onSelect,
  onClose,
  className,
}: MentionCommandsProps) {
  if (!trigger) return null;

  return (
    <div
      className={cn(
        "z-50 w-[300px] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95",
        className,
      )}
    >
      <Command className="h-auto" value={items[selectedIndex]?.id}>
        <CommandList className="max-h-[200px]">
          <CommandEmpty>
            No {trigger === "/" ? "prompts" : "assistants"} found.
          </CommandEmpty>
          <CommandGroup heading={trigger === "/" ? "Prompts" : "Assistants"}>
            {items.map((item, index) => {
              const isPrompt = trigger === "/";
              const prompt = item as Prompt;
              const assistant = item as Assistant;

              return (
                <CommandItem
                  key={item.id}
                  value={item.id}
                  onSelect={() => onSelect(item)}
                  className={cn(
                    "flex items-center gap-2 py-2 px-3",
                    index === selectedIndex &&
                      "bg-accent text-accent-foreground",
                  )}
                >
                  {!isPrompt && (
                    <Avatar className="h-6 w-6 shrink-0">
                      <AvatarImage src={assistant.avatar ?? undefined} />
                      <AvatarFallback>
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="flex flex-col w-full overflow-hidden">
                    <div className="flex w-full items-center justify-between">
                      <span className="font-medium truncate">
                        {isPrompt ? prompt.title : assistant.name}
                      </span>
                      {isPrompt && (
                        <span className="text-[10px] text-muted-foreground uppercase bg-muted px-1.5 py-0.5 rounded ml-2 shrink-0">
                          {prompt.shortcut.startsWith("/")
                            ? prompt.shortcut
                            : `/${prompt.shortcut}`}
                        </span>
                      )}
                    </div>
                    {!isPrompt && assistant.description && (
                      <span className="text-xs text-muted-foreground truncate">
                        {assistant.description}
                      </span>
                    )}
                  </div>
                </CommandItem>
              );
            })}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  );
}
