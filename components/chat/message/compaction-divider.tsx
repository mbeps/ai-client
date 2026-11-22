"use client";

import { ChevronDown, ChevronRight, Shrink, Trash2 } from "lucide-react";
import { useState } from "react";
import { MarkdownRenderer } from "@/components/chat/markdown-renderer";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { parseMessageMetadata } from "@/lib/chat/parse-message-metadata";
import type { Message } from "@/types/message/message";

interface CompactionDividerProps {
  message: Message;
  onDelete?: (messageId: string) => void;
}

/**
 * Renders a collapsible horizontal divider for a conversation compaction checkpoint.
 *
 * @param props - Component props
 * @returns Collapsible compaction checkpoint divider
 * @author Maruf Bepary
 */
export function CompactionDivider({
  message,
  onDelete,
}: CompactionDividerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const { compaction } = parseMessageMetadata(message.metadata);

  return (
    <div className="my-4 w-full px-4">
      <Collapsible open={isOpen} onOpenChange={setIsOpen}>
        <div className="flex items-center gap-3">
          <div className="bg-border h-px flex-1" />
          <div className="bg-muted/40 border-border/70 flex items-center gap-2 rounded-full border px-3 py-1 text-xs">
            <Shrink className="text-muted-foreground h-3.5 w-3.5" />
            <span className="text-foreground font-medium">
              Conversation compacted
            </span>
            {compaction?.compactedCount !== undefined && (
              <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                {compaction.compactedCount} messages
              </Badge>
            )}
            {compaction?.auto && (
              <Badge variant="outline" className="h-4 px-1.5 text-[10px]">
                Auto
              </Badge>
            )}
            <CollapsibleTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground hover:text-foreground h-5 gap-1 px-1.5 text-[11px]"
              >
                {isOpen ? (
                  <>
                    <ChevronDown className="h-3 w-3" />
                    Hide summary
                  </>
                ) : (
                  <>
                    <ChevronRight className="h-3 w-3" />
                    View summary
                  </>
                )}
              </Button>
            </CollapsibleTrigger>
            {onDelete && (
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="text-muted-foreground hover:text-destructive h-5 w-5"
                    onClick={() => onDelete(message.id)}
                    aria-label="Delete compaction checkpoint"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>Delete compaction checkpoint</TooltipContent>
              </Tooltip>
            )}
          </div>
          <div className="bg-border h-px flex-1" />
        </div>

        <CollapsibleContent className="mt-2">
          <div className="bg-muted/20 border-border/60 mx-auto max-w-3xl rounded-lg border p-3 text-xs">
            <MarkdownRenderer content={message.content} />
          </div>
        </CollapsibleContent>
      </Collapsible>
    </div>
  );
}
