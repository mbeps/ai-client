"use client";

import { formatDistanceToNow } from "date-fns";
import {
  Activity,
  AlertTriangle,
  Ban,
  CheckCircle2,
  CirclePlay,
  Clock,
  Database,
  ExternalLink,
  FileText,
  Languages,
  List,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { parseAsString, useQueryState } from "nuqs";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelJobAction } from "@/actions/jobs/cancel-job";
import { listUserJobsAction } from "@/actions/jobs/list-jobs";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import type { JobItem, JobStatus, JobType } from "@/types/jobs";

/**
 * Filter tab categories for active, queued, completed, failed, and all jobs.
 */
export type JobFilterTab =
  | "running"
  | "queued"
  | "completed"
  | "failed"
  | "all";

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

/**
 * Derives badge styling, icon, and label for each job type category.
 * @param type Category of the job.
 * @returns Icon component and display label for the job type.
 */
function getJobTypeMeta(type: JobType) {
  switch (type) {
    case "chat":
      return {
        label: "Chat",
        icon: MessageSquare,
      };
    case "transform":
      return {
        label: "Step-by-Step",
        icon: List,
      };
    case "translation":
      return {
        label: "Translation",
        icon: Languages,
      };
    case "kb-ingest":
      return {
        label: "KB Ingest",
        icon: FileText,
      };
    case "kb-reindex":
      return {
        label: "KB Re-index",
        icon: Database,
      };
    default:
      return {
        label: "Workflow",
        icon: Activity,
      };
  }
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
 * Full-featured view component for tracking, searching, filtering, and managing Inngest background jobs.
 *
 * Implements:
 * - Real-time polling with browser tab visibility pausing.
 * - Offline engine banner with manual retry trigger.
 * - Summary statistics cards across job lifecycle statuses.
 * - Type-based and status-based filtering with fuzzy search.
 * - Safe cancel confirmation dialog with dual-layer server abort.
 * - Graceful deleted entity states and disabled deep links.
 *
 * @author Maruf Bepary
 */
export function JobsView() {
  const [jobs, setJobs] = useState<JobItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [offline, setOffline] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
  const [cancelTarget, setCancelTarget] = useState<JobItem | null>(null);
  const [isPending, startTransition] = useTransition();

  const isVisibleRef = useRef<boolean>(true);

  // URL state persistence via nuqs
  const [tabParam, setTabParam] = useQueryState(
    "tab",
    parseAsString.withDefault("running").withOptions({
      shallow: true,
      history: "replace",
    }),
  );

  const [statusParam, setStatusParam] = useQueryState(
    "status",
    parseAsString.withOptions({
      shallow: true,
      history: "replace",
    }),
  );

  const activeTab: JobFilterTab = (() => {
    const raw = (statusParam || tabParam || "running").toLowerCase();
    if (raw === "queued") return "queued";
    if (raw === "completed") return "completed";
    if (raw === "failed" || raw === "cancelled") return "failed";
    if (raw === "all") return "all";
    return "running";
  })();

  const handleTabChange = (nextTab: JobFilterTab) => {
    const target = activeTab === nextTab ? "all" : nextTab;
    setTabParam(target);
    if (statusParam) {
      setStatusParam(null);
    }
  };

  /**
   * Fetches latest user background jobs from Inngest and enriches with PostgreSQL metadata.
   */
  const loadJobs = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setLoading(true);
    }
    try {
      const res = await listUserJobsAction();
      setJobs(res.jobs || []);
      setOffline(Boolean(res.offline));
      if (res.error && !res.offline) {
        toast.error(res.error);
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to load jobs";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  }, []);

  // Initial fetch on mount
  useEffect(() => {
    loadJobs(true);
  }, [loadJobs]);

  // Tab visibility listener: pause polling when hidden, resume + refresh immediately when visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      const isVisible =
        typeof document !== "undefined" &&
        document.visibilityState === "visible";
      isVisibleRef.current = isVisible;

      if (isVisible && autoRefresh) {
        loadJobs(false);
      }
    };

    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }

    return () => {
      if (typeof document !== "undefined") {
        document.removeEventListener(
          "visibilitychange",
          handleVisibilityChange,
        );
      }
    };
  }, [autoRefresh, loadJobs]);

  // Polling interval: runs every 5 seconds only when auto-refresh is active and tab is visible
  useEffect(() => {
    if (!autoRefresh) return;

    const intervalId = setInterval(() => {
      if (
        isVisibleRef.current &&
        typeof document !== "undefined" &&
        document.visibilityState === "visible"
      ) {
        loadJobs(false);
      }
    }, 5000);

    return () => clearInterval(intervalId);
  }, [autoRefresh, loadJobs]);

  // Handle job cancellation with confirmation
  const handleConfirmCancel = () => {
    if (!cancelTarget) return;

    startTransition(async () => {
      try {
        const res = await cancelJobAction(cancelTarget.id, {
          chatId:
            cancelTarget.type === "chat" ? cancelTarget.entityId : undefined,
          transformRunId:
            cancelTarget.type === "transform"
              ? cancelTarget.entityId
              : undefined,
        });

        if (res.success) {
          toast.success("Job run cancelled successfully");
          setCancelTarget(null);
          await loadJobs(false);
        } else {
          toast.error(res.error || "Failed to cancel job");
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to cancel job",
        );
      }
    });
  };

  // Stat calculations
  const runningCount = jobs.filter((j) => j.status === "RUNNING").length;
  const queuedCount = jobs.filter((j) => j.status === "QUEUED").length;
  const completedCount = jobs.filter((j) => j.status === "COMPLETED").length;
  const failedCount = jobs.filter(
    (j) => j.status === "FAILED" || j.status === "CANCELLED",
  ).length;

  const statCards = [
    {
      id: "running" as const,
      label: "Running",
      count: runningCount,
      icon: Activity,
      colorClasses: {
        active:
          "border-blue-400 bg-blue-100/90 text-blue-900 ring-2 ring-blue-500/70 shadow-xs dark:border-blue-700 dark:bg-blue-950/70 dark:text-blue-100 dark:ring-blue-400/60",
        inactive:
          "border-blue-200/80 bg-blue-50/50 text-blue-800 hover:bg-blue-100/60 dark:border-blue-900/40 dark:bg-blue-950/20 dark:text-blue-300 dark:hover:bg-blue-950/40",
        icon: "text-blue-600 dark:text-blue-400",
        text: "text-blue-900 dark:text-blue-200",
        count: "text-blue-700 dark:text-blue-300",
      },
    },
    {
      id: "queued" as const,
      label: "Queued",
      count: queuedCount,
      icon: Clock,
      colorClasses: {
        active:
          "border-amber-400 bg-amber-100/90 text-amber-900 ring-2 ring-amber-500/70 shadow-xs dark:border-amber-700 dark:bg-amber-950/70 dark:text-amber-100 dark:ring-amber-400/60",
        inactive:
          "border-amber-200/80 bg-amber-50/50 text-amber-800 hover:bg-amber-100/60 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-300 dark:hover:bg-amber-950/40",
        icon: "text-amber-600 dark:text-amber-400",
        text: "text-amber-900 dark:text-amber-200",
        count: "text-amber-700 dark:text-amber-300",
      },
    },
    {
      id: "completed" as const,
      label: "Completed",
      count: completedCount,
      icon: CheckCircle2,
      colorClasses: {
        active:
          "border-emerald-400 bg-emerald-100/90 text-emerald-900 ring-2 ring-emerald-500/70 shadow-xs dark:border-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-100 dark:ring-emerald-400/60",
        inactive:
          "border-emerald-200/80 bg-emerald-50/50 text-emerald-800 hover:bg-emerald-100/60 dark:border-emerald-900/40 dark:bg-emerald-950/20 dark:text-emerald-300 dark:hover:bg-emerald-950/40",
        icon: "text-emerald-600 dark:text-emerald-400",
        text: "text-emerald-900 dark:text-emerald-200",
        count: "text-emerald-700 dark:text-emerald-300",
      },
    },
    {
      id: "failed" as const,
      label: "Failed",
      count: failedCount,
      icon: XCircle,
      colorClasses: {
        active:
          "border-rose-400 bg-rose-100/90 text-rose-900 ring-2 ring-rose-500/70 shadow-xs dark:border-rose-700 dark:bg-rose-950/70 dark:text-rose-100 dark:ring-rose-400/60",
        inactive:
          "border-rose-200/80 bg-rose-50/50 text-rose-800 hover:bg-rose-100/60 dark:border-rose-900/40 dark:bg-rose-950/20 dark:text-rose-300 dark:hover:bg-rose-950/40",
        icon: "text-rose-600 dark:text-rose-400",
        text: "text-rose-900 dark:text-rose-200",
        count: "text-rose-700 dark:text-rose-300",
      },
    },
  ];

  // Filter jobs based on active tab and search query
  const filteredJobs = jobs.filter((job) => {
    if (activeTab === "running") {
      if (job.status !== "RUNNING") {
        return false;
      }
    } else if (activeTab === "queued") {
      if (job.status !== "QUEUED") {
        return false;
      }
    } else if (activeTab === "completed") {
      if (job.status !== "COMPLETED") {
        return false;
      }
    } else if (activeTab === "failed") {
      if (job.status !== "FAILED" && job.status !== "CANCELLED") {
        return false;
      }
    }

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchTitle = job.title?.toLowerCase().includes(q);
      const matchType = job.type?.toLowerCase().includes(q);
      const matchFunc = job.functionName?.toLowerCase().includes(q);
      const matchSubtitle = job.subtitle?.toLowerCase().includes(q);
      if (!matchTitle && !matchType && !matchFunc && !matchSubtitle) {
        return false;
      }
    }

    return true;
  });

  return (
    <div className="space-y-6">
      {/* Header Block */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-bold text-3xl tracking-tight">Running Jobs</h1>
          <p className="text-muted-foreground">
            Monitor, track, and manage active background tasks and workflow
            runs.
          </p>
        </div>
      </div>

      {/* Offline Warning Banner */}
      {offline && (
        <Alert
          variant="warning"
          className="border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40"
        >
          <AlertTriangle className="size-4 text-amber-600 dark:text-amber-400" />
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <AlertTitle className="text-amber-800 dark:text-amber-200">
                Inngest Engine Offline
              </AlertTitle>
              <AlertDescription className="text-amber-700 dark:text-amber-300">
                Cannot connect to Inngest background engine. Active runs may not
                update in real-time until connection is restored.
              </AlertDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => loadJobs(true)}
              disabled={loading}
              className="mt-2 shrink-0 bg-white sm:mt-0 dark:bg-zinc-900"
            >
              <RefreshCw
                className={cn("mr-1.5 size-3.5", loading && "animate-spin")}
              />
              Retry
            </Button>
          </div>
        </Alert>
      )}

      {/* Compact Summary Stat Cards & Tab Triggers */}
      <div
        role="tablist"
        aria-label="Filter jobs by status"
        className="grid grid-cols-2 gap-3 lg:grid-cols-4"
      >
        {statCards.map((card) => {
          const isActive = activeTab === card.id;
          const Icon = card.icon;
          return (
            <button
              key={card.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-label={`${card.label} jobs, ${card.count} total`}
              onClick={() => handleTabChange(card.id)}
              className={cn(
                "flex h-11 cursor-pointer select-none items-center justify-between gap-3 rounded-xl border px-3.5 py-2 text-left transition-all duration-150",
                "focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isActive
                  ? card.colorClasses.active
                  : card.colorClasses.inactive,
              )}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <Icon
                  className={cn("size-4 shrink-0", card.colorClasses.icon)}
                />
                <span
                  className={cn(
                    "truncate font-medium text-sm",
                    card.colorClasses.text,
                  )}
                >
                  {card.label}
                </span>
              </div>
              <span
                className={cn(
                  "shrink-0 font-bold text-base tabular-nums",
                  card.colorClasses.count,
                )}
              >
                {card.count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search, Filter Context & Auto-Refresh Controls */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search jobs by title, type, or function..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>

        <div className="flex items-center gap-3 self-end sm:self-auto">
          {activeTab !== "all" && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleTabChange("all")}
              className="h-8 text-muted-foreground text-xs hover:text-foreground"
            >
              Show all ({jobs.length})
            </Button>
          )}

          <div className="flex items-center space-x-2">
            <Switch
              id="auto-refresh-toggle"
              checked={autoRefresh}
              onCheckedChange={setAutoRefresh}
            />
            <Label
              htmlFor="auto-refresh-toggle"
              className="cursor-pointer text-xs"
            >
              Auto-refresh
            </Label>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => loadJobs(true)}
            disabled={loading}
          >
            <RefreshCw
              className={cn("mr-1.5 size-3.5", loading && "animate-spin")}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Loading Spinner on Initial Empty Load */}
      {loading && jobs.length === 0 && (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="size-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Jobs List */}
      {filteredJobs.length > 0 && (
        <div className="grid grid-cols-1 gap-3">
          {filteredJobs.map((job) => {
            const typeMeta = getJobTypeMeta(job.type);
            const TypeIcon = typeMeta.icon;
            const formattedDuration = formatJobDuration(job.durationMs);

            let timingText = "";
            if (job.startedAt) {
              try {
                timingText = `started ${formatDistanceToNow(new Date(job.startedAt), { addSuffix: true })}`;
              } catch {
                timingText = `started ${job.startedAt}`;
              }
            } else if (job.queuedAt) {
              try {
                timingText = `queued ${formatDistanceToNow(new Date(job.queuedAt), { addSuffix: true })}`;
              } catch {
                timingText = `queued ${job.queuedAt}`;
              }
            }

            return (
              <Card
                key={job.id}
                className="py-0 transition-all hover:border-primary/30"
              >
                <CardContent className="flex items-center gap-2.5 p-2.5">
                  <div className="flex min-w-0 flex-1 items-center gap-2.5">
                    <div className="shrink-0 rounded-md bg-secondary/50 p-1.5 text-secondary-foreground">
                      <TypeIcon className="size-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Badge
                          variant="secondary"
                          className="px-1.5 text-[11px]"
                        >
                          {typeMeta.label}
                        </Badge>
                        <JobStatusBadge status={job.status} />
                        {job.entityDeleted && (
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
                              <p>
                                The underlying entity was deleted or is no
                                longer available.
                              </p>
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>

                      <div className="mt-0.5 flex items-center gap-1.5">
                        {job.url && !job.entityDeleted ? (
                          <Link
                            href={job.url}
                            className="truncate font-medium text-foreground text-sm transition-colors hover:text-primary hover:underline"
                          >
                            {job.title}
                          </Link>
                        ) : (
                          <span className="truncate font-medium text-foreground text-sm">
                            {job.title}
                          </span>
                        )}
                        {job.subtitle && (
                          <span className="truncate text-muted-foreground text-xs">
                            {job.subtitle}
                          </span>
                        )}
                      </div>

                      {job.errorMessage ? (
                        <p className="mt-0.5 line-clamp-1 font-mono text-destructive text-xs">
                          {job.errorMessage}
                        </p>
                      ) : (
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-muted-foreground text-xs">
                          {timingText && (
                            <span className="flex items-center gap-1">
                              <Clock className="size-3 shrink-0" />
                              <span>{timingText}</span>
                            </span>
                          )}
                          {formattedDuration && (
                            <span>• duration: {formattedDuration}</span>
                          )}
                          {job.functionName && (
                            <span className="font-mono text-[11px] opacity-70">
                              ({job.functionName})
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-1.5">
                    {job.url && !job.entityDeleted ? (
                      <Button variant="outline" size="sm" asChild>
                        <Link href={job.url}>
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

                    {(job.status === "RUNNING" || job.status === "QUEUED") && (
                      <Button
                        variant="destructive"
                        size="sm"
                        className="px-2.5"
                        onClick={() => setCancelTarget(job)}
                      >
                        <Ban className="mr-1.5 size-3.5" />
                        Cancel
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty States */}
      {filteredJobs.length === 0 && !loading && (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <div className="rounded-full bg-muted p-4">
            <Activity className="size-8 text-muted-foreground" />
          </div>
          <h3 className="mt-4 font-semibold text-lg">
            {searchQuery
              ? "No matching jobs found"
              : activeTab === "running"
                ? "No running jobs"
                : activeTab === "queued"
                  ? "No queued jobs"
                  : activeTab === "completed"
                    ? "No completed jobs"
                    : activeTab === "failed"
                      ? "No failed jobs"
                      : "No background jobs found"}
          </h3>
          <p className="mt-1 max-w-sm text-muted-foreground text-sm">
            {searchQuery
              ? `No jobs matched "${searchQuery}". Try a different search keyword.`
              : activeTab === "running"
                ? "There are currently no background jobs running."
                : activeTab === "queued"
                  ? "There are currently no background jobs in queue."
                  : activeTab === "completed"
                    ? "There are no completed background jobs."
                    : activeTab === "failed"
                      ? "There are no failed or cancelled background jobs."
                      : "There are no background jobs tracked by Inngest."}
          </p>
        </div>
      )}

      {/* Cancel Confirmation Dialog */}
      <AlertDialog
        open={cancelTarget !== null}
        onOpenChange={(open) => {
          if (!open && !isPending) {
            setCancelTarget(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Cancel Job Run</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to cancel the job &quot;
              {cancelTarget?.title}&quot;? Any in-progress processing will be
              aborted immediately.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>
              <CirclePlay className="mr-1.5 size-4" />
              Keep Running
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={(e) => {
                e.preventDefault();
                handleConfirmCancel();
              }}
            >
              {isPending ? (
                <>
                  <Loader2 className="mr-1.5 size-4 animate-spin" />
                  Cancelling...
                </>
              ) : (
                <>
                  <Ban className="mr-1.5 size-4" />
                  Cancel Job
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
