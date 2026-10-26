"use client";

import { format } from "date-fns";
import { Calendar, FileText, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { KbDocumentRow } from "@/types/knowledgebase/kb-document-row";
import type { KnowledgebaseRow } from "@/types/knowledgebase/knowledgebase-row";

/**
 * Represents kb stats cards props.
 *
 * @author Maruf Bepary
 */
export interface KbStatsCardsProps {
  kb: KnowledgebaseRow;
  documents: KbDocumentRow[];
  onReindex: () => Promise<void> | void;
}

/**
 * Metric summary cards for a Knowledge Base: documents count, index status, and timestamps.
 *
 * @author Maruf Bepary
 */
export function KbStatsCards({ kb, documents, onReindex }: KbStatsCardsProps) {
  const readyCount = documents.filter((d) => d.status === "ready").length;

  return (
    <div className="flex flex-wrap gap-3">
      <Card className="min-w-[200px] flex-1 shadow-none">
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase">
            <FileText className="h-3.5 w-3.5" />
            Documents
          </CardDescription>
          <div className="mt-1 flex flex-col gap-0.5">
            <CardTitle className="text-xl font-bold">
              {documents.length}
            </CardTitle>
            <p className="text-muted-foreground text-[10px]">
              {documents.length === 0
                ? "Empty"
                : `${readyCount} of ${documents.length} ready`}
            </p>
          </div>
        </CardHeader>
      </Card>

      <Card className="min-w-[200px] flex-1 shadow-none">
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase">
            <RefreshCw
              className={cn(
                "h-3.5 w-3.5",
                kb.indexStatus === "indexing" && "animate-spin",
              )}
            />
            Index Status
          </CardDescription>
          <div className="mt-1 flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl font-bold capitalize">
                {kb.indexStatus}
              </CardTitle>
              {kb.indexStatus === "stale" && (
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-6 w-6"
                      onClick={onReindex}
                      aria-label="Re-index all documents"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Re-index all documents</TooltipContent>
                </Tooltip>
              )}
            </div>
            <p className="text-muted-foreground text-[10px]">
              {kb.indexStatus === "indexing"
                ? "Processing documents..."
                : kb.indexStatus === "stale"
                  ? "Needs re-indexing"
                  : "Ready for search"}
            </p>
          </div>
        </CardHeader>
      </Card>

      <Card className="min-w-[200px] flex-1 shadow-none">
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5 text-[10px] font-semibold tracking-wider uppercase">
            <Calendar className="h-3.5 w-3.5" />
            Stats
          </CardDescription>
          <div className="mt-1 flex flex-col gap-0.5">
            <CardTitle className="text-sm font-medium">
              Created {format(kb.createdAt, "PPP")}
            </CardTitle>
            <p className="text-muted-foreground text-[10px]">
              Updated {format(kb.updatedAt, "PP")}
            </p>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
