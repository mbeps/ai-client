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
 *
 * @param statusParam - Target status param
 * @param tabParam - Target tab param
 * @returns The resolved result
 * @author Maruf Bepary
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
 *
 * @param status - Current status value
 * @param activeTab - Target active tab
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function matchesJobTab(
  status: JobStatus,
  activeTab: JobFilterTab,
): boolean {
  return TAB_STATUS_MATCH[activeTab]?.(status) ?? false;
}

/**
 * Checks whether a job matches search keywords across title, type, function name, and subtitle.
 *
 * @param job - Target job
 * @param normalizedQuery - Target normalized query
 * @returns The resolved result
 * @author Maruf Bepary
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
 *
 * @param job - Target job
 * @param activeTab - Target active tab
 * @param searchQuery - Target search query
 * @returns The resolved result
 * @author Maruf Bepary
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
 *
 * @param jobs - Target jobs
 * @returns The resolved result
 * @author Maruf Bepary
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
