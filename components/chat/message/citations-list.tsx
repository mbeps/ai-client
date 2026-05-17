"use client";

import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { FileText, Download, ExternalLink } from "lucide-react";
import { Citation } from "@/lib/chat/parse-message-metadata";
import { getAttachmentUrl } from "@/lib/actions/attachments/get-attachment-url";
import { toast } from "sonner";
import { useMemo } from "react";

interface CitationsListProps {
  citations: Citation[];
}

/**
 * Renders a list of citations grouped by document.
 * Displays interactive badges that open a popover with cited snippets.
 * Includes functionality to download the source document.
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

  const handleDownload = async (s3Key: string, fileName: string) => {
    try {
      const result = await getAttachmentUrl(s3Key);
      if (result?.url) {
        window.open(result.url, "_blank");
      } else {
        toast.error("Failed to get download URL");
      }
    } catch (error) {
      console.error("Download error:", error);
      toast.error("Error downloading file");
    }
  };

  return (
    <div className="flex flex-wrap gap-2 mt-4 mb-2 animate-in fade-in slide-in-from-bottom-1 duration-300">
      <div className="flex items-center gap-1.5 text-[10px] font-bold text-muted-foreground uppercase tracking-wider w-full mb-1">
        <FileText className="size-3" />
        Sources
      </div>
      {groupedCitations.map((group, idx) => (
        <Popover key={`${group.name}-${idx}`}>
          <PopoverTrigger asChild>
            <Badge
              variant="secondary"
              className="cursor-pointer hover:bg-secondary/80 transition-colors py-1 px-2 gap-1.5 flex items-center text-xs font-medium max-w-[200px]"
            >
              <FileText className="size-3 shrink-0 text-primary/70" />
              <span className="truncate">{group.name}</span>
              <span className="bg-primary/10 text-primary-foreground size-4 rounded-full flex items-center justify-center text-[10px]">
                {group.snippets.length}
              </span>
            </Badge>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0 overflow-hidden" align="start">
            <div className="flex items-center justify-between p-3 border-b bg-muted/30">
              <div className="font-semibold text-sm truncate pr-2">
                {group.name}
              </div>
              <Button
                size="icon"
                variant="ghost"
                className="size-7 shrink-0"
                onClick={() => handleDownload(group.s3Key, group.name)}
                title="Download source"
              >
                <Download className="size-3.5" />
              </Button>
            </div>
            <ScrollArea className="max-h-[300px]">
              <div className="p-3 space-y-4">
                {group.snippets.map((snippet, sIdx) => (
                  <div key={sIdx} className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-muted-foreground font-mono">
                        Snippet {sIdx + 1}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-success/10 text-success font-medium">
                        {Math.round(snippet.relevanceScore * 100)}% match
                      </span>
                    </div>
                    <p className="text-xs leading-relaxed text-foreground italic border-l-2 border-primary/20 pl-2 py-0.5">
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
