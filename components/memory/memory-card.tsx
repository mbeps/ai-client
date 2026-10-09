"use client";

import { formatDistanceToNow } from "date-fns";
import { Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { Memory } from "@/types/memory/memory";

/**
 * Props for the MemoryCard component.
 */
interface MemoryCardProps {
  /** Memory object containing content and timestamps. */
  memory: Memory;
  /** Whether this memory item is currently selected. */
  isSelected?: boolean;
  /** Callback invoked when the user toggles selection for this memory. */
  onToggleSelect?: (memory: Memory) => void;
  /** Callback invoked when the user clicks the edit button. */
  onEdit: (memory: Memory) => void;
  /** Callback invoked when the user clicks the delete button. */
  onDelete: (memory: Memory) => void;
}

/**
 * Displays a single remembered fact or preference with its creation date and action buttons.
 *
 * @param props.memory - The memory item to display.
 * @param props.isSelected - Whether this item is selected for batch operations.
 * @param props.onToggleSelect - Handler for toggling selection.
 * @param props.onEdit - Function triggered when edit action is chosen.
 * @param props.onDelete - Function triggered when delete action is chosen.
 * @author Maruf Bepary
 */
export function MemoryCard({
  memory,
  isSelected = false,
  onToggleSelect,
  onEdit,
  onDelete,
}: MemoryCardProps) {
  const timeAgo = formatDistanceToNow(new Date(memory.createdAt), {
    addSuffix: true,
  });

  return (
    <Card
      className={cn(
        "flex h-full min-h-[110px] flex-col justify-between p-4 transition-colors hover:bg-muted/30",
        isSelected && "border-primary/60 bg-primary/5 dark:bg-primary/10",
      )}
    >
      <div className="space-y-2">
        <div className="flex items-start justify-between gap-3">
          <p className="flex-1 whitespace-pre-wrap break-words text-foreground text-sm leading-relaxed">
            {memory.content}
          </p>
          {onToggleSelect && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelect(memory)}
              aria-label="Select memory"
              className="mt-0.5 shrink-0"
            />
          )}
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t pt-2">
        <span
          className="text-muted-foreground text-xs"
          title={new Date(memory.createdAt).toLocaleString()}
        >
          {timeAgo}
        </span>

        <div className="flex items-center gap-1">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                onClick={() => onEdit(memory)}
                aria-label="Edit memory"
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Edit memory</TooltipContent>
          </Tooltip>

          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => onDelete(memory)}
                aria-label="Delete memory"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </TooltipTrigger>
            <TooltipContent>Delete memory</TooltipContent>
          </Tooltip>
        </div>
      </div>
    </Card>
  );
}
