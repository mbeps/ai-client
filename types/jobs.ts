import type { PendingApproval } from "@/types/tool/approval";

/**
 * Category/type of an Inngest background job.
 */
export type JobType =
  | "chat"
  | "workflow"
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
 * Filter tab categories for active, queued, completed, failed, and all jobs.
 */
export type JobFilterTab =
  | "running"
  | "queued"
  | "completed"
  | "failed"
  | "all";

/**
 * Pending human review or tool execution approval attached to an active job.
 */
export type JobApprovalInfo =
  | {
      kind: "workflow-review";
      runId: string;
      nodeId: string;
      nodeName?: string;
      gateId?: string;
      reviewPhase?: "before" | "after";
    }
  | {
      kind: "workflow-tool";
      runId: string;
      nodeId: string;
      nodeName?: string;
      gateId?: string;
      pendingApprovals: PendingApproval[];
    }
  | {
      kind: "chat-tool";
      assistantMessageId: string;
      pendingApprovals: PendingApproval[];
    };

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
  /** Pending approval gate or tool execution requests if the job is paused waiting for user action. */
  approval?: JobApprovalInfo;
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
