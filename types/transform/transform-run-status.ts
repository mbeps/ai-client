/**
 * Status of a transform run execution.
 * - "pending": Created but not yet started.
 * - "running": Currently executing steps.
 * - "awaiting_review": Paused for manual approval before next step.
 * - "completed": Successfully finished all steps.
 * - "failed": Stopped due to error.
 *
 * @author Maruf Bepary
 */
export type TransformRunStatus =
  | "pending"
  | "running"
  | "awaiting_review"
  | "completed"
  | "failed";
