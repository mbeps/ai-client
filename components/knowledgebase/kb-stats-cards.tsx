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
import { cn } from "@/lib/utils";
import type { KbDocumentRow } from "@/types/knowledgebase/kb-document-row";
import type { KnowledgebaseRow } from "@/types/knowledgebase/knowledgebase-row";

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
          <CardDescription className="flex items-center gap-1.5 font-semibold text-[10px] uppercase tracking-wider">
            <FileText className="h-3.5 w-3.5" />
            Documents
          </CardDescription>
          <div className="mt-1 flex flex-col gap-0.5">
            <CardTitle className="font-bold text-xl">
              {documents.length}
            </CardTitle>
            <p className="text-[10px] text-muted-foreground">
              {documents.length === 0
                ? "Empty"
                : `${readyCount} of ${documents.length} ready`}
            </p>
          </div>
        </CardHeader>
      </Card>

      <Card className="min-w-[200px] flex-1 shadow-none">
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5 font-semibold text-[10px] uppercase tracking-wider">
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
              <CardTitle className="font-bold text-xl capitalize">
                {kb.indexStatus}
              </CardTitle>
              {kb.indexStatus === "stale" && (
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={onReindex}
                  title="Re-index all documents"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground">
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
          <CardDescription className="flex items-center gap-1.5 font-semibold text-[10px] uppercase tracking-wider">
            <Calendar className="h-3.5 w-3.5" />
            Stats
          </CardDescription>
          <div className="mt-1 flex flex-col gap-0.5">
            <CardTitle className="font-medium text-sm">
              Created {format(kb.createdAt, "PPP")}
            </CardTitle>
            <p className="text-[10px] text-muted-foreground">
              Updated {format(kb.updatedAt, "PP")}
            </p>
          </div>
        </CardHeader>
      </Card>
    </div>
  );
}
export default KbStatsCards;
