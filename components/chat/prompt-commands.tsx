"use client";

import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { type Prompt } from "@/lib/store";
import { cn } from "@/lib/utils";

interface PromptCommandsProps {
  filteredPrompts: Prompt[];
  selectedIndex: number;
  onSelect: (prompt: Prompt) => void;
  onClose: () => void;
  className?: string;
}

/**
 * A command palette for prompt snippets triggered by / in the chat input.
 *
 * @author Maruf Bepary
 */
export function PromptCommands({
  filteredPrompts,
  selectedIndex,
  onSelect,
  onClose,
  className,
}: PromptCommandsProps) {
  if (filteredPrompts.length === 0) return null;

  return (
    <div
      className={cn(
        "z-50 w-[300px] overflow-hidden rounded-md border bg-popover text-popover-foreground shadow-md animate-in fade-in-0 zoom-in-95",
        className
      )}
    >
      <Command
        className="h-auto"
        value={filteredPrompts[selectedIndex]?.id}
      >
        <CommandList className="max-h-[200px]">
          <CommandEmpty>No prompts found.</CommandEmpty>
          <CommandGroup heading="Prompts">
            {filteredPrompts.map((prompt, index) => (
              <CommandItem
                key={prompt.id}
                value={prompt.id}
                onSelect={() => onSelect(prompt)}
                className={cn(
                  "flex flex-col items-start gap-1 py-2 px-3",
                  index === selectedIndex && "bg-accent text-accent-foreground"
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="font-medium">{prompt.title}</span>
                  <span className="text-[10px] text-muted-foreground uppercase bg-muted px-1.5 py-0.5 rounded">
                    {prompt.shortcut.startsWith("/")
                      ? prompt.shortcut
                      : `/${prompt.shortcut}`}
                  </span>
                </div>
                {/* <span className="text-xs text-muted-foreground line-clamp-1">
                  {prompt.content}
                </span> */}
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </Command>
    </div>
  );
}
