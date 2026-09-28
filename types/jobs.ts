/**
 * Category/type of an Inngest background job.
 */
export type JobType =
  | "chat"
  | "transform"
  | "translation"
  | "kb-ingest"
  | "kb-reindex"
  | "other";

/**
 * Execution status for an Inngest background job.
 */
export type JobStatus =
  | "RUNNING"
  | "QUEUED"
  | "COMPLETED"
  | "FAILED"
  | "CANCELLED";

/**
 * Normalized representation of an Inngest job run.
 */
export interface JobItem {
  /** Inngest run ID. */
  id: string;
  /** Inngest function identifier (slug). */
  functionId: string;
  /** Human-readable function name. */
  functionName: string;
  /** Triggering event name. */
  eventName: string;
  /** Functional category of the job. */
  type: JobType;
  /** Primary title to display for this job run. */
  title: string;
  /** Optional secondary subtitle or detail. */
  subtitle?: string;
  /** Current execution status. */
  status: JobStatus;
  /** ISO timestamp when job was queued. */
  queuedAt: string;
  /** ISO timestamp when job started execution, or null if queued. */
  startedAt: string | null;
  /** ISO timestamp when job ended execution, or null if not yet finished. */
  endedAt: string | null;
  /** Total execution duration in milliseconds. */
  durationMs?: number;
  /** Link to entity or detail page associated with this job. */
  url?: string;
  /** Error message if the run failed. */
  errorMessage?: string;
  /** ID of the associated entity (e.g. document ID, knowledge base ID, transform agent ID). */
  entityId?: string;
  /** Whether the underlying entity was deleted. */
  entityDeleted?: boolean;
}

/**
 * Result returned by the job listing action.
 */
export interface ListJobsResult {
  /** List of retrieved job items. */
  jobs: JobItem[];
  /** Whether Inngest dev server or API is unreachable / offline. */
  offline?: boolean;
  /** Error message if retrieval encountered a failure. */
  error?: string;
}
