/**
 * Ordered identifiers for document upload and background ingestion stages.
 */
export type KbIngestStepId =
  | "uploading"
  | "extracting"
  | "embedding"
  | "metadata"
  | "relations";

/**
 * Execution state of an individual document ingestion step.
 */
export type KbIngestStepStatus = "pending" | "loading" | "completed" | "failed";

/**
 * Status entry and optional diagnostic message for a single ingestion step.
 */
export interface KbIngestStepEntry {
  status: KbIngestStepStatus;
  error?: string;
}

/**
 * Map of all ingestion step identifiers to their current status entries.
 */
export type KbIngestStepsState = Record<KbIngestStepId, KbIngestStepEntry>;
