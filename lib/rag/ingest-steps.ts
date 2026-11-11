import { KB_INGEST_STEPS } from "@/config/knowledgebase";
import type {
  KbIngestStepId,
  KbIngestStepsState,
} from "@/types/knowledgebase/kb-ingest-steps";

/**
 * Builds a complete initial ingestion steps map with every step defaulting to
 * `pending` unless overridden.
 *
 * @param overrides - Partial step states to apply on top of the pending baseline
 * @returns Full five-step state record
 */
export function createInitialIngestSteps(
  overrides?: Partial<KbIngestStepsState>,
): KbIngestStepsState {
  return {
    uploading: { status: "pending" },
    extracting: { status: "pending" },
    embedding: { status: "pending" },
    metadata: { status: "pending" },
    relations: { status: "pending" },
    ...overrides,
  };
}

/**
 * Builds a step map where steps prior to `failedStep` are marked `completed`,
 * `failedStep` is marked `failed` with `errorMessage`, and subsequent steps
 * remain `pending`.
 *
 * @param failedStep - The step identifier that failed
 * @param errorMessage - Human-readable error explanation
 * @returns Full five-step state record reflecting the failure boundary
 */
export function buildFailedIngestSteps(
  failedStep: KbIngestStepId,
  errorMessage: string,
): KbIngestStepsState {
  const result = createInitialIngestSteps();
  let seenFailure = false;

  for (const step of KB_INGEST_STEPS) {
    if (step.id === failedStep) {
      result[step.id] = { status: "failed", error: errorMessage };
      seenFailure = true;
    } else if (!seenFailure) {
      result[step.id] = { status: "completed" };
    }
  }

  return result;
}
