"use client";

import { Loader2 } from "lucide-react";
import { parseAsString, useQueryState } from "nuqs";
import { useCallback, useState, useTransition } from "react";
import { toast } from "sonner";
import { cancelJob } from "@/actions/jobs/cancel-job";
import { listJobs } from "@/actions/jobs/list-jobs";
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
import type { JobFilterTab, JobItem } from "@/types/jobs";

/**
 * Page header component.
 */
function JobsHeader() {
  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Running Jobs</h1>
        <p className="text-muted-foreground">
          Monitor, track, and manage active background tasks and workflow runs.
        </p>
      </div>
    </div>
  );
}

interface JobsListProps {
  jobs: JobItem[];
  onCancel: (job: JobItem) => void;
}

/**
 * Renders the collection of job cards.
 */
function JobsList({ jobs, onCancel }: JobsListProps) {
  if (jobs.length === 0) return null;

  return (
    <div className="grid grid-cols-1 gap-3">
      {jobs.map((job) => (
        <JobRunCard key={job.id} job={job} onCancel={onCancel} />
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

  useJobsPolling(loadJobs, autoRefresh);

  const handleConfirmCancel = () => {
    if (!cancelTarget) return;

    startTransition(async () => {
      try {
        const res = await cancelJob(cancelTarget.id, {
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

  const statCounts = computeStatCounts(jobs);
  const filteredJobs = jobs.filter((job) =>
    matchesJobFilter(job, activeTab, searchQuery),
  );

  return (
    <div className="space-y-6">
      <JobsHeader />

      <JobsOfflineBanner
        offline={offline}
        loading={loading}
        onRetry={() => loadJobs(true)}
      />

      <JobsStatCards
        counts={statCounts}
        activeTab={activeTab}
        onTabChange={handleTabChange}
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

      {loading && jobs.length === 0 && (
        <div className="flex items-center justify-center p-12">
          <Loader2 className="text-muted-foreground size-8 animate-spin" />
        </div>
      )}

      <JobsList jobs={filteredJobs} onCancel={setCancelTarget} />

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
