"use client";

import { formatDistanceToNow } from "date-fns";
import { Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { Memory } from "@/types/memory/memory";

/**
 * Props for the MemoryCard component.
 */
interface MemoryCardProps {
  /** Memory object containing content and timestamps. */
  memory: Memory;
  /** Callback invoked when the user clicks the edit button. */
  onEdit: (memory: Memory) => void;
  /** Callback invoked when the user clicks the delete button. */
  onDelete: (memory: Memory) => void;
}

/**
 * Displays a single remembered fact or preference with its creation date and action buttons.
 *
 * @param props.memory - The memory item to display.
 * @param props.onEdit - Function triggered when edit action is chosen.
 * @param props.onDelete - Function triggered when delete action is chosen.
 * @author Maruf Bepary
 */
export function MemoryCard({ memory, onEdit, onDelete }: MemoryCardProps) {
  const timeAgo = formatDistanceToNow(new Date(memory.createdAt), {
    addSuffix: true,
  });

  return (
    <Card className="flex h-full min-h-[110px] flex-col justify-between p-4 transition-colors hover:bg-muted/30">
      <div className="space-y-2">
        <p className="whitespace-pre-wrap break-words text-foreground text-sm leading-relaxed">
          {memory.content}
        </p>
      </div>

      <div className="mt-4 flex items-center justify-between gap-2 border-t pt-2">
        <span
          className="text-muted-foreground text-xs"
          title={new Date(memory.createdAt).toLocaleString()}
        >
          {timeAgo}
        </span>

        <div className="flex items-center gap-1">
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
        </div>
      </div>
    </Card>
  );
}
