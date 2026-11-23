"use client";

import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  Ban,
  Clock,
  Database,
  ExternalLink,
  FileText,
  Languages,
  MessageSquare,
  ShieldAlert,
  Workflow,
} from "lucide-react";
import Link from "next/link";
import { JobApprovalPanel } from "@/components/jobs/job-approval-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type {
  JobApprovalInfo,
  JobItem,
  JobStatus,
  JobType,
} from "@/types/jobs";
import type { ApprovalDecision } from "@/types/tool/approval";

/**
 * Formats duration in milliseconds into a concise readable string.
 * @param durationMs Duration in milliseconds.
 * @returns Formatted duration string or null if duration is absent.
 */
function formatJobDuration(durationMs?: number): string | null {
  if (durationMs === undefined || durationMs === null || durationMs < 0) {
    return null;
  }
  if (durationMs < 1000) {
    return `${durationMs}ms`;
  }
  const totalSeconds = Math.floor(durationMs / 1000);
  if (totalSeconds < 60) {
    return `${totalSeconds}s`;
  }
  const minutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return remainingSeconds > 0
    ? `${minutes}m ${remainingSeconds}s`
    : `${minutes}m`;
}

const JOB_TYPE_META: Record<JobType, { label: string; icon: typeof Activity }> =
  {
    chat: { label: "Chat", icon: MessageSquare },
    workflow: { label: "Workflow", icon: Workflow },
    translation: { label: "Translation", icon: Languages },
    "kb-ingest": { label: "KB Ingest", icon: FileText },
    "kb-reindex": { label: "KB Re-index", icon: Database },
    other: { label: "Workflow", icon: Activity },
  };

/**
 * Derives badge styling, icon, and label for each job type category.
 * @param type Category of the job.
 * @returns Icon component and display label for the job type.
 */
function getJobTypeMeta(type: JobType) {
  return JOB_TYPE_META[type] ?? { label: "Workflow", icon: Activity };
}

/**
 * Renders an accessible, colored badge matching the given job status.
 * @param status Current status of the job.
 * @returns Status badge JSX element.
 */
function JobStatusBadge({ status }: { status: JobStatus }) {
  switch (status) {
    case "RUNNING":
      return (
        <Badge
          variant="outline"
          className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        >
          <span className="relative mr-1.5 flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Running
        </Badge>
      );
    case "QUEUED":
      return (
        <Badge
          variant="outline"
          className="border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
        >
          <span className="mr-1.5 size-2 rounded-full bg-amber-500" />
          Queued
        </Badge>
      );
    case "COMPLETED":
      return (
        <Badge
          variant="outline"
          className="border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
        >
          <span className="mr-1.5 size-2 rounded-full bg-emerald-500" />
          Completed
        </Badge>
      );
    case "FAILED":
      return (
        <Badge
          variant="destructive"
          className="border-destructive/30 bg-destructive/10 text-destructive"
        >
          <span className="bg-destructive mr-1.5 size-2 rounded-full" />
          Failed
        </Badge>
      );
    case "CANCELLED":
      return (
        <Badge variant="outline" className="text-muted-foreground">
          <span className="bg-muted-foreground/60 mr-1.5 size-2 rounded-full" />
          Cancelled
        </Badge>
      );
  }
}

/**
 * Badge indicating that the target entity was deleted in PostgreSQL.
 */
function JobDeletedBadge() {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Badge
          variant="outline"
          className="text-muted-foreground cursor-help border-dashed text-xs"
        >
          Deleted
        </Badge>
      </TooltipTrigger>
      <TooltipContent>
        <p>The underlying entity was deleted or is no longer available.</p>
      </TooltipContent>
    </Tooltip>
  );
}

/**
 * Formats job timing text safely with relative time.
 *
 * @param startedAt - Target started at
 * @param queuedAt - Target queued at
 * @returns The resolved result
 * @author Maruf Bepary
 */
function formatJobTiming(
  startedAt?: string | null,
  queuedAt?: string | null,
): string {
  const target = startedAt ?? queuedAt;
  if (!target) return "";
  const prefix = startedAt ? "started" : "queued";
  try {
    return `${prefix} ${formatDistanceToNow(new Date(target), { addSuffix: true })}`;
  } catch {
    return `${prefix} ${target}`;
  }
}

/**
 * Represents job card title props.
 *
 * @author Maruf Bepary
 */
interface JobCardTitleProps {
  url?: string;
  entityDeleted?: boolean;
  title: string;
  subtitle?: string;
}

/**
 * Renders the job card title component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
function JobCardTitle({
  url,
  entityDeleted,
  title,
  subtitle,
}: JobCardTitleProps) {
  const hasLink = Boolean(url && !entityDeleted);

  return (
    <div className="mt-1 flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5">
      {hasLink ? (
        <Link
          href={url as string}
          className="text-foreground hover:text-primary truncate text-sm font-semibold transition-colors hover:underline"
        >
          {title}
        </Link>
      ) : (
        <span className="text-foreground truncate text-sm font-semibold">
          {title}
        </span>
      )}
      {subtitle && (
        <span className="text-muted-foreground truncate text-xs">
          {subtitle}
        </span>
      )}
    </div>
  );
}

/**
 * Represents job card meta details props.
 *
 * @author Maruf Bepary
 */
interface JobCardMetaDetailsProps {
  errorMessage?: string;
  timingText: string;
  formattedDuration: string | null;
  functionName?: string;
}

/**
 * Renders the job card meta details component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
function JobCardMetaDetails({
  errorMessage,
  timingText,
  formattedDuration,
  functionName,
}: JobCardMetaDetailsProps) {
  return (
    <div className="mt-1 space-y-1.5">
      <div className="text-muted-foreground flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
        {timingText && (
          <span className="flex items-center gap-1">
            <Clock className="size-3 shrink-0" />
            <span>{timingText}</span>
          </span>
        )}
        {formattedDuration && (
          <span className="tabular-nums">• {formattedDuration}</span>
        )}
        {functionName && (
          <span className="bg-muted/60 rounded px-1.5 py-0.5 font-mono text-[10px] opacity-80">
            {functionName}
          </span>
        )}
      </div>

      {errorMessage && (
        <p className="border-destructive/20 bg-destructive/5 text-destructive line-clamp-2 rounded-md border px-2 py-1 font-mono text-xs">
          {errorMessage}
        </p>
      )}
    </div>
  );
}

/**
 * Represents job card actions props.
 *
 * @author Maruf Bepary
 */
interface JobCardActionsProps {
  url?: string;
  entityDeleted?: boolean;
  status: JobStatus;
  onCancel: (job: JobItem) => void;
  job: JobItem;
}

/**
 * Renders the job card actions component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
function JobCardActions({
  url,
  entityDeleted,
  status,
  onCancel,
  job,
}: JobCardActionsProps) {
  const canOpen = Boolean(url && !entityDeleted);
  const canCancel = status === "RUNNING" || status === "QUEUED";

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      {canOpen ? (
        <Button variant="outline" size="sm" asChild>
          <Link href={url as string}>
            Open
            <ExternalLink className="ml-1.5 size-3.5" />
          </Link>
        </Button>
      ) : (
        <Button variant="outline" size="sm" disabled>
          Open
          <ExternalLink className="ml-1.5 size-3.5" />
        </Button>
      )}

      {canCancel && (
        <Button
          variant="destructive"
          size="sm"
          className="px-2.5"
          onClick={() => onCancel(job)}
        >
          <Ban className="mr-1.5 size-3.5" />
          Cancel
        </Button>
      )}
    </div>
  );
}

/**
 * Represents job run card props.
 *
 * @author Maruf Bepary
 */
export interface JobRunCardProps {
  job: JobItem;
  onCancel: (job: JobItem) => void;
  isApproving?: boolean;
  onApproveWorkflowReview?: (
    approval: Extract<JobApprovalInfo, { kind: "workflow-review" }>,
    approved: boolean,
    feedback?: string,
  ) => Promise<void> | void;
  onSubmitToolDecisions?: (
    approval: Extract<JobApprovalInfo, { kind: "workflow-tool" | "chat-tool" }>,
    approved: boolean,
    decisions: ApprovalDecision[],
  ) => Promise<void> | void;
}

/**
 * Renders a status badge indicating a job is paused waiting for user approval.
 */
function JobApprovalBadge({ approval }: { approval: JobApprovalInfo }) {
  const isReview = approval.kind === "workflow-review";
  return (
    <Badge
      variant="outline"
      className={cn(
        "gap-1 text-[11px]",
        isReview
          ? "border-amber-500/40 bg-amber-500/10 text-amber-600 dark:text-amber-400"
          : "border-orange-500/40 bg-orange-500/10 text-orange-600 dark:text-orange-400",
      )}
    >
      <ShieldAlert className="size-3" />
      {isReview ? "Awaiting Review" : "Approval Required"}
    </Badge>
  );
}

/**
 * Card displaying an individual background job run with status, timing, deep link,
 * inline approval controls (when paused), and cancellation actions.
 */
export function JobRunCard({
  job,
  onCancel,
  isApproving = false,
  onApproveWorkflowReview,
  onSubmitToolDecisions,
}: JobRunCardProps) {
  const typeMeta = getJobTypeMeta(job.type);
  const TypeIcon = typeMeta.icon;
  const formattedDuration = formatJobDuration(job.durationMs);
  const timingText = formatJobTiming(job.startedAt, job.queuedAt);
  const hasApproval = Boolean(job.approval);

  return (
    <Card
      className={cn(
        "overflow-hidden py-0 transition-colors",
        hasApproval
          ? "border-amber-500/40 shadow-xs"
          : "hover:border-primary/30",
      )}
    >
      <CardContent className="flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div
            className={cn(
              "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg border",
              hasApproval
                ? "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400"
                : "border-border/60 bg-muted/50 text-muted-foreground",
            )}
          >
            <TypeIcon className="size-4" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="px-1.5 text-[11px]">
                {typeMeta.label}
              </Badge>
              <JobStatusBadge status={job.status} />
              {job.approval && <JobApprovalBadge approval={job.approval} />}
              {job.entityDeleted && <JobDeletedBadge />}
            </div>

            <JobCardTitle
              url={job.url}
              entityDeleted={job.entityDeleted}
              title={job.title}
              subtitle={job.subtitle}
            />

            <JobCardMetaDetails
              errorMessage={job.errorMessage}
              timingText={timingText}
              formattedDuration={formattedDuration}
              functionName={job.functionName}
            />
          </div>
        </div>

        <JobCardActions
          url={job.url}
          entityDeleted={job.entityDeleted}
          status={job.status}
          onCancel={onCancel}
          job={job}
        />
      </CardContent>

      {job.approval && onApproveWorkflowReview && onSubmitToolDecisions && (
        <JobApprovalPanel
          approval={job.approval}
          isSubmitting={isApproving}
          onApproveWorkflowReview={onApproveWorkflowReview}
          onSubmitToolDecisions={onSubmitToolDecisions}
        />
      )}
    </Card>
  );
}
