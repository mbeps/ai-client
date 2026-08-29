"use client";

import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, RefreshCw, Calendar } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { KnowledgebaseRow } from "@/types/knowledgebase/knowledgebase-row";
import type { KbDocumentRow } from "@/types/knowledgebase/kb-document-row";

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
      <Card className="flex-1 min-w-[200px] shadow-none">
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold">
            <FileText className="h-3.5 w-3.5" />
            Documents
          </CardDescription>
          <div className="flex flex-col gap-0.5 mt-1">
            <CardTitle className="text-xl font-bold">
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

      <Card className="flex-1 min-w-[200px] shadow-none">
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold">
            <RefreshCw
              className={cn(
                "h-3.5 w-3.5",
                kb.indexStatus === "indexing" && "animate-spin",
              )}
            />
            Index Status
          </CardDescription>
          <div className="flex flex-col gap-0.5 mt-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-xl font-bold capitalize">
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

      <Card className="flex-1 min-w-[200px] shadow-none">
        <CardHeader>
          <CardDescription className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-semibold">
            <Calendar className="h-3.5 w-3.5" />
            Stats
          </CardDescription>
          <div className="flex flex-col gap-0.5 mt-1">
            <CardTitle className="text-sm font-medium">
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
