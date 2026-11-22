"use client";

import { Bot, BrainCircuit, Database, SquareTerminal, Zap } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  isActionItem,
  isAssistantItem,
  isKnowledgebaseItem,
  isPromptItem,
  isSkillItem,
} from "@/hooks/chat/mention-item-guards";
import type {
  MentionItem,
  MentionTrigger,
  MentionTypeFilter,
} from "@/hooks/chat/use-mention-commands";
import { cn } from "@/lib/utils";
import type { Agent } from "@/types/agent/agent";

/**
 * Represents mention commands props.
 *
 * @author Maruf Bepary
 */
interface MentionCommandsProps {
  items: MentionItem[];
  trigger: MentionTrigger;
  typeFilter?: MentionTypeFilter | null;
  selectedIndex: number;
  onSelect: (item: MentionItem) => void;
  onClose: () => void;
  className?: string;
}

/**
 * Dropdown menu for unified slash commands (`/`) covering skills, prompts, assistants, and knowledgebases.
 * Separates each category into its own distinct group.
 *
 * @author Maruf Bepary
 */
export function MentionCommands({
  items,
  trigger,
  typeFilter,
  selectedIndex,
  onSelect,
  className,
}: MentionCommandsProps) {
  if (!trigger) return null;

  const actionItems = items.filter(isActionItem);
  const skillItems = items.filter(isSkillItem);
  const promptItems = items.filter(isPromptItem);
  const assistantItems = items.filter(isAssistantItem);
  const knowledgebaseItems = items.filter(isKnowledgebaseItem);

  const getEmptyMessage = () => {
    switch (typeFilter) {
      case "action":
        return "actions";
      case "skill":
        return "skills";
      case "prompt":
        return "prompts";
      case "agent":
        return "assistants";
      case "knowledgebase":
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

          {skillItems.length > 0 && (
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

          {promptItems.length > 0 && (
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

          {assistantItems.length > 0 && (
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
                        {(item as Agent).name}
                      </span>
                      {(item as Agent).description && (
                        <span className="text-muted-foreground truncate text-xs">
                          {(item as Agent).description}
                        </span>
                      )}
                    </div>
                  </CommandItem>
                );
              })}
            </CommandGroup>
          )}

          {knowledgebaseItems.length > 0 && (
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
          {actionItems.length > 0 && (
            <CommandGroup
              heading={
                <span className="flex items-center gap-1.5">
                  <Zap className="h-3 w-3" />
                  Actions
                </span>
              }
            >
              {actionItems.map((item) => {
                const index = items.indexOf(item);
                const isSelected = index === selectedIndex;

                return (
                  <CommandItem
                    key={item.id}
                    value={item.name}
                    onSelect={() => onSelect(item)}
                    className={cn(
                      "flex cursor-pointer items-center justify-between gap-2 px-2 py-1.5",
                      isSelected && "bg-accent text-accent-foreground",
                    )}
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">{item.title}</span>
                      <span className="text-muted-foreground truncate text-xs">
                        {item.description}
                      </span>
                    </div>
                    <span className="text-muted-foreground bg-muted shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px]">
                      /{item.name}
                    </span>
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
