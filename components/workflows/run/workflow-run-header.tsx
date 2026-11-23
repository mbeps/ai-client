"use client";

import { ArrowLeft, Download, GitBranch, List, Loader2 } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { ROUTES } from "@/config/routes";
import { downloadFile } from "@/lib/utils/download-file";
import type { WorkflowRunStatus } from "@/types/workflows/workflow";

const STATUS_BADGE_CLASSES: Record<WorkflowRunStatus, string> = {
  completed: "bg-green-500 text-white",
  running: "bg-blue-500 text-white",
  failed: "bg-red-500 text-white",
  pending: "bg-gray-500 text-white",
  awaiting_review: "bg-amber-500 text-white",
  awaiting_tool_approval: "bg-orange-500 text-white",
};

/** Props for {@link WorkflowRunHeader}. */
export interface WorkflowRunHeaderProps {
  workflowId: string;
  workflowName: string;
  status: WorkflowRunStatus;
  progress: number;
  dryRun: boolean;
  viewMode: "graph" | "timeline";
  onViewModeChange: (mode: "graph" | "timeline") => void;
  outputAttachmentIds?: string[];
  attachmentMeta?: Record<string, { url: string; name: string }>;
}

/**
 * Top control bar for live workflow execution monitoring and view switching.
 */
export function WorkflowRunHeader({
  workflowId,
  workflowName,
  status,
  progress,
  dryRun,
  viewMode,
  onViewModeChange,
  outputAttachmentIds = [],
  attachmentMeta = {},
}: WorkflowRunHeaderProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  const lastOutputId = outputAttachmentIds[outputAttachmentIds.length - 1];
  const finalMeta = lastOutputId ? attachmentMeta[lastOutputId] : undefined;

  const handleDownloadFinal = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!finalMeta || isDownloading) return;
    setIsDownloading(true);
    try {
      await downloadFile(finalMeta.url, finalMeta.name);
    } catch {
      toast.error("Failed to download output file");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="border-border bg-background flex flex-wrap items-center gap-4 border-b px-6 py-3">
      <Link href={ROUTES.WORKFLOWS.AUTOMATIONS.detail(workflowId)}>
        <Button variant="ghost" size="icon">
          <ArrowLeft className="h-4 w-4" />
        </Button>
      </Link>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="truncate text-lg font-semibold">{workflowName}</h1>
          <Badge className={STATUS_BADGE_CLASSES[status]}>
            {status.replaceAll("_", " ")}
          </Badge>
          {dryRun && <Badge variant="outline">Dry Run</Badge>}
        </div>
        <div className="flex max-w-xs items-center gap-2">
          <Progress value={progress} className="h-1.5" />
          <span className="text-muted-foreground text-xs">
            {Math.round(progress)}%
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <div className="bg-muted flex items-center rounded-md p-0.5">
          <Button
            type="button"
            variant={viewMode === "graph" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onViewModeChange("graph")}
          >
            <GitBranch className="mr-1.5 h-3.5 w-3.5" />
            Graph View
          </Button>
          <Button
            type="button"
            variant={viewMode === "timeline" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => onViewModeChange("timeline")}
          >
            <List className="mr-1.5 h-3.5 w-3.5" />
            Timeline View
          </Button>
        </div>

        {finalMeta && (
          <>
            <Separator orientation="vertical" className="hidden h-6 lg:block" />
            <Button size="sm" disabled={isDownloading} asChild>
              <a
                href={finalMeta.url}
                download={finalMeta.name}
                onClick={handleDownloadFinal}
              >
                {isDownloading ? (
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Download className="mr-1.5 h-3.5 w-3.5" />
                )}
                Download Final Result
              </a>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
