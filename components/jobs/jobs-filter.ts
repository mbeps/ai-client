import type { JobsStatCounts } from "@/components/jobs/jobs-stat-cards";
import type { JobFilterTab, JobItem, JobStatus } from "@/types/jobs";

const TAB_MAP: Record<string, JobFilterTab> = {
  queued: "queued",
  completed: "completed",
  failed: "failed",
  cancelled: "failed",
  all: "all",
};

/**
 * Resolves the currently active tab from status or tab query parameters.
 */
export function resolveActiveTab(
  statusParam?: string | null,
  tabParam?: string | null,
): JobFilterTab {
  const raw = (statusParam ?? tabParam ?? "running").toLowerCase();
  return TAB_MAP[raw] ?? "running";
}

const TAB_STATUS_MATCH: Record<JobFilterTab, (s: JobStatus) => boolean> = {
  all: () => true,
  running: (s) => s === "RUNNING",
  queued: (s) => s === "QUEUED",
  completed: (s) => s === "COMPLETED",
  failed: (s) => s === "FAILED" || s === "CANCELLED",
};

/**
 * Checks whether a job's status matches the given active tab category.
 */
export function matchesJobTab(
  status: JobStatus,
  activeTab: JobFilterTab,
): boolean {
  return TAB_STATUS_MATCH[activeTab]?.(status) ?? false;
}

/**
 * Checks whether a job matches search keywords across title, type, function name, and subtitle.
 */
export function matchesJobSearch(
  job: JobItem,
  normalizedQuery: string,
): boolean {
  if (!normalizedQuery) {
    return true;
  }
  const fields = [job.title, job.type, job.functionName, job.subtitle];
  return fields.some((field) => field?.toLowerCase().includes(normalizedQuery));
}

/**
 * Filters a job based on the active tab and search query.
 */
export function matchesJobFilter(
  job: JobItem,
  activeTab: JobFilterTab,
  searchQuery: string,
): boolean {
  if (!matchesJobTab(job.status, activeTab)) {
    return false;
  }
  return matchesJobSearch(job, searchQuery.trim().toLowerCase());
}

const STATUS_FIELD_MAP: Partial<Record<JobStatus, keyof JobsStatCounts>> = {
  RUNNING: "running",
  QUEUED: "queued",
  COMPLETED: "completed",
  FAILED: "failed",
  CANCELLED: "failed",
};

/**
 * Aggregates count summaries across lifecycle states for stat cards.
 */
export function computeStatCounts(jobs: readonly JobItem[]): JobsStatCounts {
  const counts: JobsStatCounts = {
    running: 0,
    queued: 0,
    completed: 0,
    failed: 0,
    all: jobs.length,
  };

  for (const j of jobs) {
    const field = STATUS_FIELD_MAP[j.status];
    if (field) {
      counts[field] += 1;
    }
  }

  return counts;
}
