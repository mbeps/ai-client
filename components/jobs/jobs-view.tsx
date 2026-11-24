"use client";

import { ShieldAlert } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { respondToToolApproval } from "@/actions/chats/respond-to-tool-approval";
import { cancelJob } from "@/actions/jobs/cancel-job";
import { listJobs } from "@/actions/jobs/list-jobs";
import { approveWorkflowRunAction } from "@/actions/workflow-runs/approve-workflow-run";
import { CancelJobDialog } from "@/components/jobs/cancel-job-dialog";
import { JobRunCard } from "@/components/jobs/job-run-card";
import { JobsControlsBar } from "@/components/jobs/jobs-controls-bar";
import { JobsEmptyState } from "@/components/jobs/jobs-empty-state";
import {
  computeStatCounts,
  matchesJobFilter,
  resolveActiveTab,
} from "@/components/jobs/jobs-filter";
import { JobsOfflineBanner } from "@/components/jobs/jobs-offline-banner";
import { JobsStatCards } from "@/components/jobs/jobs-stat-cards";
import { useJobsPolling } from "@/components/jobs/use-jobs-polling";
import { TableListSkeleton } from "@/components/skeletons/table-list-skeleton";
import { Badge } from "@/components/ui/badge";
import type { JobApprovalInfo, JobFilterTab, JobItem } from "@/types/jobs";
import type { ApprovalDecision } from "@/types/tool/approval";

/**
 * Page header component.
 */
function JobsHeader({
  awaitingApprovalCount,
}: {
  awaitingApprovalCount: number;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Running Jobs</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Monitor, track, and manage active background tasks and workflow runs.
        </p>
      </div>
      {awaitingApprovalCount > 0 && (
        <Badge
          variant="outline"
          className="w-fit gap-1.5 border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-medium text-amber-600 dark:text-amber-400"
        >
          <ShieldAlert className="size-3.5" />
          <span className="tabular-nums">{awaitingApprovalCount}</span>
          awaiting approval
        </Badge>
      )}
    </div>
  );
}

/**
 * Represents jobs list props.
 *
 * @author Maruf Bepary
 */
interface JobsListProps {
  jobs: JobItem[];
  onCancel: (job: JobItem) => void;
  approvingJobIds: Set<string>;
  onApproveWorkflowReview: (
    jobId: string,
    approval: Extract<JobApprovalInfo, { kind: "workflow-review" }>,
    approved: boolean,
    feedback?: string,
  ) => Promise<void>;
  onSubmitToolDecisions: (
    jobId: string,
    approval: Extract<JobApprovalInfo, { kind: "workflow-tool" | "chat-tool" }>,
    approved: boolean,
    decisions: ApprovalDecision[],
  ) => Promise<void>;
}

/**
 * Renders the collection of job cards.
 */
function JobsList({
  jobs,
  onCancel,
  approvingJobIds,
  onApproveWorkflowReview,
  onSubmitToolDecisions,
}: JobsListProps) {
  if (jobs.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-3">
      {jobs.map((job) => (
        <JobRunCard
          key={job.id}
          job={job}
          onCancel={onCancel}
          isApproving={approvingJobIds.has(job.id)}
          onApproveWorkflowReview={(approval, approved, feedback) =>
            onApproveWorkflowReview(job.id, approval, approved, feedback)
          }
          onSubmitToolDecisions={(approval, approved, decisions) =>
            onSubmitToolDecisions(job.id, approval, approved, decisions)
          }
        />
      ))}
    </div>
  );
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
  const [approvingJobIds, setApprovingJobIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [isPending, startTransition] = useTransition();

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

  const activeTab = resolveActiveTab(statusParam, tabParam);

  const handleTabChange = (nextTab: JobFilterTab) => {
    const target = activeTab === nextTab ? "all" : nextTab;
    setTabParam(target);
    if (statusParam) {
      setStatusParam(null);
    }
  };

  const loadJobs = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setLoading(true);
    }
    try {
      const res = await listJobs();
      if (res.ok) {
        setJobs(res.value.jobs || []);
        setOffline(Boolean(res.value.offline));
        if (isManualRefresh && res.value.error && !res.value.offline) {
          toast.error(res.value.error);
        }
      } else if (isManualRefresh) {
        toast.error(res.error.message || "Failed to load jobs");
      }
    } catch (err) {
      if (isManualRefresh) {
        const message =
          err instanceof Error ? err.message : "Failed to load jobs";
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useJobsPolling(loadJobs, autoRefresh);

  const handleConfirmCancel = () => {
    if (!cancelTarget) return;

    startTransition(async () => {
      try {
        const res = await cancelJob(cancelTarget.id, {
          chatId:
            cancelTarget.type === "chat" ? cancelTarget.entityId : undefined,
          workflowRunId:
            cancelTarget.type === "workflow"
              ? cancelTarget.entityId
              : undefined,
        });

        if (res.ok) {
          toast.success("Job run cancelled successfully");
          setCancelTarget(null);
          await loadJobs(false);
        } else {
          toast.error(res.error.message || "Failed to cancel job");
        }
      } catch (err) {
        toast.error(
          err instanceof Error ? err.message : "Failed to cancel job",
        );
      }
    });
  };

  const withJobApproval = async (
    jobId: string,
    errorFallback: string,
    task: () => Promise<void>,
  ) => {
    setApprovingJobIds((prev) => new Set(prev).add(jobId));
    try {
      await task();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : errorFallback);
    } finally {
      setApprovingJobIds((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }
  };

  const handleApproveWorkflowReview = (
    jobId: string,
    approval: Extract<JobApprovalInfo, { kind: "workflow-review" }>,
    approved: boolean,
    feedback?: string,
  ) =>
    withJobApproval(jobId, "Failed to submit approval", async () => {
      const res = await approveWorkflowRunAction({
        runId: approval.runId,
        nodeId: approval.nodeId,
        gateId: approval.gateId,
        approved,
        feedback,
      });
      if (!res.ok) {
        toast.error(res.error.message || "Failed to submit approval");
        return;
      }
      toast.success(
        approved
          ? "Approval submitted — resuming workflow"
          : "Run rejected and stopped",
      );
      await loadJobs(false);
    });

  const handleSubmitToolDecisions = (
    jobId: string,
    approval: Extract<JobApprovalInfo, { kind: "workflow-tool" | "chat-tool" }>,
    approved: boolean,
    decisions: ApprovalDecision[],
  ) =>
    withJobApproval(jobId, "Failed to submit tool approval", async () => {
      const res =
        approval.kind === "workflow-tool"
          ? await approveWorkflowRunAction({
              runId: approval.runId,
              nodeId: approval.nodeId,
              gateId: approval.gateId,
              approved,
              toolDecisions: decisions,
            })
          : await respondToToolApproval({
              assistantMessageId: approval.assistantMessageId,
              decisions,
            });

      if (!res.ok) {
        toast.error(res.error.message || "Failed to submit tool approval");
        return;
      }
      toast.success(
        approved
          ? "Tool approval submitted — resuming run"
          : "Tool execution denied",
      );
      await loadJobs(false);
    });

  const statCounts = computeStatCounts(jobs);
  const awaitingApprovalCount = jobs.filter((j) => Boolean(j.approval)).length;
  const filteredJobs = jobs.filter((job) =>
    matchesJobFilter(job, activeTab, searchQuery),
  );

  return (
    <div className="space-y-6">
      <JobsHeader awaitingApprovalCount={awaitingApprovalCount} />

      <JobsOfflineBanner
        offline={offline}
        loading={loading}
        onRetry={() => loadJobs(true)}
      />

      <JobsStatCards
        counts={statCounts}
        activeTab={activeTab}
        onTabChange={handleTabChange}
        awaitingApprovalCount={awaitingApprovalCount}
      />

      <JobsControlsBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        activeTab={activeTab}
        totalJobs={jobs.length}
        onShowAll={() => handleTabChange("all")}
        autoRefresh={autoRefresh}
        onAutoRefreshChange={setAutoRefresh}
        onRefresh={() => loadJobs(true)}
        loading={loading}
      />

      {loading && jobs.length === 0 && <TableListSkeleton rows={4} />}

      <JobsList
        jobs={filteredJobs}
        onCancel={setCancelTarget}
        approvingJobIds={approvingJobIds}
        onApproveWorkflowReview={handleApproveWorkflowReview}
        onSubmitToolDecisions={handleSubmitToolDecisions}
      />

      {filteredJobs.length === 0 && !loading && (
        <JobsEmptyState activeTab={activeTab} searchQuery={searchQuery} />
      )}

      <CancelJobDialog
        cancelTarget={cancelTarget}
        isPending={isPending}
        onOpenChange={(open) => {
          if (!open) setCancelTarget(null);
        }}
        onConfirm={handleConfirmCancel}
      />
    </div>
  );
}
