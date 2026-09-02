"use client";

import { FileText } from "lucide-react";
import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { Citation } from "@/types/chat/citation";

interface CitationsListProps {
  citations: Citation[];
}

/**
 * Renders a list of citations grouped by document.
 * Displays interactive badges that open a popover with cited snippets.
 */
export function CitationsList({ citations }: CitationsListProps) {
  // Group citations by document name for organized display
  const groupedCitations = useMemo(() => {
    if (!citations || citations.length === 0) return [];

    const groups: Record<
      string,
      { name: string; s3Key: string; snippets: Citation[] }
    > = {};

    citations.forEach((c) => {
      // Basic validation to avoid crashes with malformed data
      if (!c.documentId || !c.content) return;

      if (!groups[c.documentId]) {
        groups[c.documentId] = {
          name: c.documentName || "Unknown Document",
          s3Key: c.s3Key,
          snippets: [],
        };
      }
      groups[c.documentId].snippets.push(c);
    });

    return Object.values(groups);
  }, [citations]);

  if (!citations || citations.length === 0 || groupedCitations.length === 0)
    return null;

  return (
    <div className="fade-in slide-in-from-bottom-1 mt-4 mb-2 flex animate-in flex-wrap gap-2 duration-300">
      <div className="mb-1 flex w-full items-center gap-1.5 font-bold text-[10px] text-muted-foreground uppercase tracking-wider">
        <FileText className="size-3" />
        Sources
      </div>
      {groupedCitations.map((group, idx) => (
        <Popover key={`${group.name}-${idx}`}>
          <PopoverTrigger asChild>
            <Badge
              variant="secondary"
              className="flex max-w-[200px] cursor-pointer items-center gap-1.5 px-2 py-1 font-medium text-xs transition-colors hover:bg-secondary/80"
            >
              <FileText className="size-3 shrink-0 text-primary/70" />
              <span className="truncate">{group.name}</span>
              <span className="flex size-4 items-center justify-center rounded-full bg-primary/10 text-[10px] text-primary-foreground">
                {group.snippets.length}
              </span>
            </Badge>
          </PopoverTrigger>
          <PopoverContent
            className="w-[min(42rem,calc(100vw-2rem))] overflow-hidden p-0"
            align="start"
          >
            <div className="flex items-center justify-between border-b bg-muted/30 p-3">
              <div className="truncate pr-2 font-semibold text-sm">
                {group.name}
              </div>
            </div>
            <ScrollArea className="h-[300px] max-h-[70vh]">
              <div className="space-y-4 p-3">
                {group.snippets.map((snippet, sIdx) => (
                  <div key={sIdx} className="space-y-1.5">
                    <div className="flex items-center">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        Snippet {sIdx + 1}
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap break-words border-primary/20 border-l-2 py-0.5 pl-2 text-foreground text-xs italic leading-relaxed [overflow-wrap:anywhere]">
                      &quot;{snippet.content}&quot;
                    </p>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </PopoverContent>
        </Popover>
      ))}
    </div>
  );
}
