"use client";

import { Download, Loader2, Play, ThumbsUp } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { downloadFile } from "@/lib/utils/download-file";
import type { TransformRunStatus } from "@/types/transform/transform-run-status";

const STATUS_COLORS: Record<string, string> = {
  completed: "bg-green-500",
  running: "bg-blue-500",
  failed: "bg-red-500",
  pending: "bg-gray-500",
  awaiting_review: "bg-amber-500",
};

/**
 * Represents final download button props.
 *
 * @author Maruf Bepary
 */
interface FinalDownloadButtonProps {
  outputAttachmentIds?: string[];
  attachmentMeta: Record<string, { url: string; name: string }>;
}

/**
 * Renders the final download button component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
function FinalDownloadButton({
  outputAttachmentIds,
  attachmentMeta,
}: FinalDownloadButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  if (!outputAttachmentIds || outputAttachmentIds.length === 0) return null;
  const finalId = outputAttachmentIds[outputAttachmentIds.length - 1];
  const finalMeta = attachmentMeta[finalId];
  if (!finalMeta) return null;

  const handleDownload = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (isDownloading) return;
    setIsDownloading(true);
    try {
      await downloadFile(finalMeta.url, finalMeta.name);
    } catch {
      toast.error("Failed to download file. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <>
      <Separator orientation="vertical" className="mr-2 hidden h-8 lg:block" />
      <Button
        size="sm"
        disabled={isDownloading}
        className="bg-primary hover:bg-primary/90 text-xs shadow-md"
        asChild
      >
        <a
          href={finalMeta.url}
          download={finalMeta.name}
          onClick={handleDownload}
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
  );
}

/**
 * Represents approve button props.
 *
 * @author Maruf Bepary
 */
interface ApproveButtonProps {
  onApprove: () => void;
  isApproving: boolean;
}

/**
 * Renders the approve button component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
function ApproveButton({ onApprove, isApproving }: ApproveButtonProps) {
  return (
    <>
      <Separator orientation="vertical" className="mr-4 hidden h-8 lg:block" />
      <Button
        size="sm"
        className="bg-amber-600 text-xs shadow-lg hover:bg-amber-700"
        onClick={onApprove}
        disabled={isApproving}
      >
        {isApproving ? (
          <Loader2 className="mr-2 h-3 w-3 animate-spin" />
        ) : (
          <ThumbsUp className="mr-2 h-3 w-3" />
        )}
        Approve
      </Button>
    </>
  );
}

/**
 * Renders the status badge component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
function StatusBadge({ status }: { status: TransformRunStatus }) {
  const statusColor = STATUS_COLORS[status] ?? "bg-gray-500";
  return (
    <div className="flex min-w-fit shrink-0 flex-col gap-0.5">
      <span className="text-muted-foreground/70 text-[10px] font-bold tracking-wider uppercase">
        Status
      </span>
      <Badge
        variant="outline"
        className="border-primary/20 bg-primary/5 flex h-5 items-center gap-1.5 px-2 text-[10px] whitespace-nowrap capitalize"
      >
        <div className={`h-1 w-1 rounded-full ${statusColor} animate-pulse`} />
        {status.replace("_", " ")}
      </Badge>
    </div>
  );
}

/**
 * Renders the progress indicator component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
function ProgressIndicator({ progress }: { progress: number }) {
  return (
    <div className="flex min-w-[120px] shrink-0 flex-col gap-1 lg:min-w-40">
      <span className="text-muted-foreground/70 text-[10px] font-bold tracking-wider uppercase">
        Progress
      </span>
      <div className="flex items-center gap-2 lg:gap-3">
        <Progress value={progress} className="h-1.5 flex-1" />
        <span className="text-[10px] font-bold tabular-nums">
          {Math.round(progress)}%
        </span>
      </div>
    </div>
  );
}

/**
 * Represents transform run header props.
 *
 * @author Maruf Bepary
 */
export interface TransformRunHeaderProps {
  agentName: string;
  createdAt: Date;
  status: TransformRunStatus;
  progress: number;
  outputAttachmentIds?: string[];
  attachmentMeta: Record<string, { url: string; name: string }>;
  onApprove: () => void;
  isApproving: boolean;
}

/**
 * Header section for transform run detail displaying status, progress, and run actions.
 */
export function TransformRunHeader({
  agentName,
  createdAt,
  status,
  progress,
  outputAttachmentIds,
  attachmentMeta,
  onApprove,
  isApproving,
}: TransformRunHeaderProps) {
  return (
    <div className="bg-card/50 flex shrink-0 flex-col gap-4 border-b p-4 backdrop-blur-sm lg:flex-row lg:items-center lg:gap-6 lg:p-6">
      <div className="flex items-center gap-3">
        <PageHeader
          icon={<Play className="h-6 w-6 text-blue-500 lg:h-8 lg:w-8" />}
          title={`Run: ${agentName}`}
          description={`Started on ${createdAt.toLocaleString()}`}
        />
      </div>

      <div className="no-scrollbar flex items-center gap-4 overflow-x-auto pb-2 lg:ml-auto lg:gap-6 lg:pb-0">
        <StatusBadge status={status} />
        <Separator orientation="vertical" className="hidden h-8 lg:block" />
        <ProgressIndicator progress={progress} />

        <div className="flex shrink-0 items-center gap-2">
          {status === "completed" && (
            <FinalDownloadButton
              outputAttachmentIds={outputAttachmentIds}
              attachmentMeta={attachmentMeta}
            />
          )}

          {status === "awaiting_review" && (
            <ApproveButton onApprove={onApprove} isApproving={isApproving} />
          )}
        </div>
      </div>
    </div>
  );
}
