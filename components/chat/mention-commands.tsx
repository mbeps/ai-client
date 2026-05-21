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
import type { MentionTrigger, MentionItem } from "@/hooks/chat/use-mention-commands";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bot, Zap, SquareTerminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface MentionCommandsProps {
  items: MentionItem[];
  trigger: MentionTrigger;
  selectedIndex: number;
  onSelect: (item: MentionItem) => void;
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
        "z-50 w-[350px] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95",
        className,
      )}
    >
      <Command className="h-auto" value={items[selectedIndex]?.id}>
        <CommandList className="max-h-[250px]">
          <CommandEmpty>
            No {trigger === "/" ? "prompts" : "assistants"} found.
          </CommandEmpty>
          <CommandGroup heading={trigger === "/" ? "Prompts" : "Assistants"}>
            {items.map((item, index) => {
              const isPromptTrigger = trigger === "/";
              const isAssistantTrigger = trigger === "@";
              
              const isMcp = "isMcp" in item && item.isMcp;

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
                  {isAssistantTrigger && !isMcp && (
                    <Avatar className="h-6 w-6 shrink-0">
                      <AvatarImage src={(item as Assistant).avatar ?? undefined} />
                      <AvatarFallback>
                        <Bot className="h-4 w-4" />
                      </AvatarFallback>
                    </Avatar>
                  )}
                  {isPromptTrigger && isMcp && (
                    <Zap className="h-4 w-4 text-amber-500 shrink-0" />
                  )}
                  {isPromptTrigger && !isMcp && (
                    <SquareTerminal className="h-4 w-4 text-muted-foreground shrink-0" />
                  )}
                  
                  <div className="flex flex-col w-full overflow-hidden">
                    <div className="flex w-full items-center justify-between">
                      <span className="font-medium truncate">
                        {isMcp ? (item as any).name : (isPromptTrigger ? (item as any).title : (item as any).name)}
                      </span>
                      {isPromptTrigger && !isMcp && (
                        <span className="text-[10px] text-muted-foreground uppercase bg-muted px-1.5 py-0.5 rounded ml-2 shrink-0">
                          {(item as any).shortcut.startsWith("/")
                            ? (item as any).shortcut
                            : `/${(item as any).shortcut}`}
                        </span>
                      )}
                      {isMcp && (
                        <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 ml-2 max-w-[100px] truncate">
                          {(item as any).sourceServer}
                        </Badge>
                      )}
                    </div>
                    {((!isMcp && isAssistantTrigger && (item as Assistant).description) || (isMcp && (item as any).description)) && (
                      <span className="text-xs text-muted-foreground truncate">
                        {isMcp ? (item as any).description : (item as Assistant).description}
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
