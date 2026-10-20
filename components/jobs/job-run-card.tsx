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
  List,
  MessageSquare,
} from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { JobItem, JobStatus, JobType } from "@/types/jobs";

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
    transform: { label: "Step-by-Step", icon: List },
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
          <span className="mr-1.5 size-2 rounded-full bg-destructive" />
          Failed
        </Badge>
      );
    case "CANCELLED":
      return (
        <Badge variant="outline" className="text-muted-foreground">
          <span className="mr-1.5 size-2 rounded-full bg-muted-foreground/60" />
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
          className="cursor-help border-dashed text-muted-foreground text-xs"
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

interface JobCardTitleProps {
  url?: string;
  entityDeleted?: boolean;
  title: string;
  subtitle?: string;
}

function JobCardTitle({
  url,
  entityDeleted,
  title,
  subtitle,
}: JobCardTitleProps) {
  const hasLink = Boolean(url && !entityDeleted);

  return (
    <div className="mt-0.5 flex items-center gap-1.5">
      {hasLink ? (
        <Link
          href={url as string}
          className="truncate font-medium text-foreground text-sm transition-colors hover:text-primary hover:underline"
        >
          {title}
        </Link>
      ) : (
        <span className="truncate font-medium text-foreground text-sm">
          {title}
        </span>
      )}
      {subtitle && (
        <span className="truncate text-muted-foreground text-xs">
          {subtitle}
        </span>
      )}
    </div>
  );
}

interface JobCardMetaDetailsProps {
  errorMessage?: string;
  timingText: string;
  formattedDuration: string | null;
  functionName?: string;
}

function JobCardMetaDetails({
  errorMessage,
  timingText,
  formattedDuration,
  functionName,
}: JobCardMetaDetailsProps) {
  if (errorMessage) {
    return (
      <p className="mt-0.5 line-clamp-1 font-mono text-destructive text-xs">
        {errorMessage}
      </p>
    );
  }

  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-muted-foreground text-xs">
      {timingText && (
        <span className="flex items-center gap-1">
          <Clock className="size-3 shrink-0" />
          <span>{timingText}</span>
        </span>
      )}
      {formattedDuration && <span>• duration: {formattedDuration}</span>}
      {functionName && (
        <span className="font-mono text-[11px] opacity-70">
          ({functionName})
        </span>
      )}
    </div>
  );
}

interface JobCardActionsProps {
  url?: string;
  entityDeleted?: boolean;
  status: JobStatus;
  onCancel: (job: JobItem) => void;
  job: JobItem;
}

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

export interface JobRunCardProps {
  job: JobItem;
  onCancel: (job: JobItem) => void;
}

/**
 * Card displaying an individual background job run with status, timing, deep link, and cancellation actions.
 */
export function JobRunCard({ job, onCancel }: JobRunCardProps) {
  const typeMeta = getJobTypeMeta(job.type);
  const TypeIcon = typeMeta.icon;
  const formattedDuration = formatJobDuration(job.durationMs);
  const timingText = formatJobTiming(job.startedAt, job.queuedAt);

  return (
    <Card className="py-0 transition-all hover:border-primary/30">
      <CardContent className="flex items-center gap-2.5 p-2.5">
        <div className="flex min-w-0 flex-1 items-center gap-2.5">
          <div className="shrink-0 rounded-md bg-secondary/50 p-1.5 text-secondary-foreground">
            <TypeIcon className="size-3.5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="secondary" className="px-1.5 text-[11px]">
                {typeMeta.label}
              </Badge>
              <JobStatusBadge status={job.status} />
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
    </Card>
  );
}
