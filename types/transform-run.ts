export type TransformRunStatus =
  | "pending"
  | "running"
  | "awaiting_review"
  | "completed"
  | "failed";

/**
 * Normalized store representation of a single execution of a TransformAgent.
 */
export type TransformRun = {
  id: string;
  agentId: string;
  userId: string;
  status: TransformRunStatus;
  currentStepIndex: number | null;
  dryRun: boolean;
  inputAttachmentIds: string[];
  outputAttachmentIds: string[];
  errorMessage: string;
  createdAt: Date;
  updatedAt: Date;
};
