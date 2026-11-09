"use client";

import { Bot, BrainCircuit, Database, SquareTerminal } from "lucide-react";
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
  isKnowledgebaseItem,
  isPromptItem,
  isSkillItem,
} from "@/hooks/chat/mention-item-guards";
import type {
  MentionItem,
  MentionTrigger,
} from "@/hooks/chat/use-mention-commands";
import { cn } from "@/lib/utils";
import type { Assistant } from "@/types/assistant/assistant";

/**
 * Represents mention commands props.
 *
 * @author Maruf Bepary
 */
interface MentionCommandsProps {
  items: MentionItem[];
  trigger: MentionTrigger;
  selectedIndex: number;
  onSelect: (item: MentionItem) => void;
  onClose: () => void;
  className?: string;
}

/**
 * Dropdown menu for mention commands (prompts & skills via `/`, assistants via `@`, knowledgebases via `#`).
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
  const knowledgebaseItems = items.filter(isKnowledgebaseItem);

  const getEmptyMessage = () => {
    switch (trigger) {
      case "/":
        return "skills or prompts";
      case "@":
        return "assistants";
      case "#":
        return "knowledgebases";
      default:
        return "items";
    }
  };

  return (
    <div
      className={cn(
        "fade-in-0 zoom-in-95 animate-in bg-popover text-popover-foreground z-50 w-[380px] overflow-hidden rounded-md border shadow-md",
        className,
      )}
    >
      <Command
        className="h-auto"
        value={items[selectedIndex]?.id}
        shouldFilter={false}
      >
        <CommandList className="max-h-[300px]">
          <CommandEmpty>No {getEmptyMessage()} found.</CommandEmpty>

          {trigger === "/" && skillItems.length > 0 && (
            <CommandGroup
              heading={
                <div className="flex items-center gap-1.5">
                  <BrainCircuit className="h-3.5 w-3.5" />
                  <span>Skills</span>
                </div>
              }
            >
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
                    <div className="flex w-full items-center justify-between overflow-hidden">
                      <span className="truncate font-medium">
                        {item.displayName || item.name}
                      </span>
                      <span className="bg-muted text-muted-foreground ml-2 shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px]">
                        /{item.name}
                      </span>
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          {trigger === "/" && promptItems.length > 0 && (
            <CommandGroup
              heading={
                <div className="flex items-center gap-1.5">
                  <SquareTerminal className="h-3.5 w-3.5" />
                  <span>Prompts</span>
                </div>
              }
            >
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
                    <div className="flex w-full items-center justify-between overflow-hidden">
                      <span className="truncate font-medium">
                        {isMcp ? (item as any).name : (item as any).title}
                      </span>
                      {!isMcp && (
                        <span className="bg-muted text-muted-foreground ml-2 shrink-0 rounded px-1.5 py-0.5 text-[10px] uppercase">
                          {(item as any).shortcut.startsWith("/")
                            ? (item as any).shortcut
                            : `/${(item as any).shortcut}`}
                        </span>
                      )}
                      {isMcp && (
                        <Badge
                          variant="outline"
                          className="ml-2 h-4 max-w-[100px] truncate px-1 py-0 text-[10px] font-normal"
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
            <CommandGroup
              heading={
                <div className="flex items-center gap-1.5">
                  <Bot className="h-3.5 w-3.5" />
                  <span>Assistants</span>
                </div>
              }
            >
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
                    <div className="flex w-full flex-col overflow-hidden">
                      <span className="truncate font-medium">
                        {(item as Assistant).name}
                      </span>
                      {(item as Assistant).description && (
                        <span className="text-muted-foreground truncate text-xs">
                          {(item as Assistant).description}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          {trigger === "#" && knowledgebaseItems.length > 0 && (
            <CommandGroup
              heading={
                <div className="flex items-center gap-1.5">
                  <Database className="h-3.5 w-3.5" />
                  <span>Knowledgebases</span>
                </div>
              }
            >
              {knowledgebaseItems.map((item) => {
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
                    <div className="flex w-full flex-col overflow-hidden">
                      <span className="truncate font-medium">{item.name}</span>
                      {item.description && (
                        <span className="text-muted-foreground truncate text-xs">
                          {item.description}
                        </span>
                      )}
                      <span className="text-muted-foreground text-xs">
                        {item.documentCount} documents • {item.indexStatus}
                      </span>
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
