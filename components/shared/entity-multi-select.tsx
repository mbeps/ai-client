"use client";

import { Check, ChevronsUpDown, X } from "lucide-react";
import * as React from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface EntitySelectItem {
  id: string;
  name: string;
  description?: string | null;
}

export interface EntityMultiSelectProps {
  items: EntitySelectItem[];
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  placeholder?: string;
  searchPlaceholder?: string;
  emptyMessage?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Reusable multi-select combobox using Shadcn Popover and Command.
 * Renders a searchable selection dropdown and a list of removable badges.
 *
 * @author Maruf Bepary
 */
export function EntityMultiSelect({
  items,
  selectedIds,
  onChange,
  placeholder = "Select items...",
  searchPlaceholder = "Search...",
  emptyMessage = "No items found.",
  disabled = false,
  className,
}: EntityMultiSelectProps) {
  const [open, setOpen] = React.useState(false);

  const selectedItems = React.useMemo(
    () => items.filter((item) => selectedIds.includes(item.id)),
    [items, selectedIds],
  );

  const toggleItem = (id: string) => {
    if (selectedIds.includes(id)) {
      onChange(selectedIds.filter((item) => item !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

  const selectAll = () => {
    onChange(items.map((i) => i.id));
  };

  const clearAll = () => {
    onChange([]);
  };

  return (
    <div className={cn("space-y-2", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            disabled={disabled || items.length === 0}
            className="w-full justify-between font-normal"
          >
            <span className="truncate text-sm">
              {selectedIds.length === 0
                ? items.length === 0
                  ? "None available"
                  : placeholder
                : `${selectedIds.length} of ${items.length} selected`}
            </span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="w-(--radix-popover-trigger-width) p-0"
          align="start"
        >
          <Command>
            <CommandInput placeholder={searchPlaceholder} />
            <div className="flex items-center justify-between border-b px-3 py-1.5 text-xs">
              <button
                type="button"
                onClick={selectAll}
                className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                Select all
              </button>
              <button
                type="button"
                onClick={clearAll}
                className="text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
              >
                Clear all
              </button>
            </div>
            <CommandList>
              <CommandEmpty>{emptyMessage}</CommandEmpty>
              <CommandGroup>
                {items.map((item) => {
                  const isSelected = selectedIds.includes(item.id);
                  return (
                    <CommandItem
                      key={item.id}
                      value={item.name}
                      onSelect={() => toggleItem(item.id)}
                      className="cursor-pointer"
                    >
                      <div className="flex w-full items-center gap-2">
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleItem(item.id)}
                          className="pointer-events-none"
                        />
                        <div className="flex-1 truncate">
                          <p className="truncate text-sm font-medium">
                            {item.name}
                          </p>
                          {item.description && (
                            <p className="text-muted-foreground line-clamp-1 text-xs">
                              {item.description}
                            </p>
                          )}
                        </div>
                        {isSelected && (
                          <Check className="text-primary h-4 w-4 shrink-0" />
                        )}
                      </div>
                    </CommandItem>
                  );
                })}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5 pt-1">
          {selectedItems.map((item) => (
            <Badge
              key={item.id}
              variant="secondary"
              className="gap-1 pr-1 text-xs"
            >
              <span className="max-w-[180px] truncate">{item.name}</span>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => toggleItem(item.id)}
                  className="hover:bg-muted-foreground/20 cursor-pointer rounded-xs p-0.5 transition-colors"
                  aria-label={`Remove ${item.name}`}
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
