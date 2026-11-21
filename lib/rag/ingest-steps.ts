import { env, type RagMode } from "@/config/env";
import type {
  KbIngestStepId,
  KbIngestStepsState,
} from "@/types/knowledgebase/kb-ingest-steps";

const ACTIVE_STEPS_BY_MODE: Record<RagMode, KbIngestStepId[]> = {
  hybrid: ["uploading", "extracting", "embedding", "metadata", "relations"],
  vector: ["uploading", "extracting", "embedding"],
  file_read: ["uploading", "extracting", "metadata", "relations"],
};

/**
 * Returns the ordered list of active ingestion step IDs for the given RAG mode.
 *
 * @param ragMode - Active RAG strategy (defaults to `env.RAG_MODE`)
 * @returns Ordered array of step identifiers executed in this mode
 */
export function getActiveIngestStepIds(
  ragMode: RagMode = env.RAG_MODE,
): KbIngestStepId[] {
  return ACTIVE_STEPS_BY_MODE[ragMode];
}

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
 * Builds a step map where active steps prior to `failedStep` are marked `completed`,
 * `failedStep` is marked `failed` with `errorMessage`, and inactive or subsequent steps
 * remain `pending`.
 *
 * @param failedStep - The step identifier that failed
 * @param errorMessage - Human-readable error explanation
 * @param ragMode - Active RAG strategy (defaults to `env.RAG_MODE`)
 * @returns Full five-step state record reflecting the failure boundary
 */
export function buildFailedIngestSteps(
  failedStep: KbIngestStepId,
  errorMessage: string,
  ragMode: RagMode = env.RAG_MODE,
): KbIngestStepsState {
  const result = createInitialIngestSteps();
  const activeStepIds = getActiveIngestStepIds(ragMode);
  let seenFailure = false;

  for (const stepId of activeStepIds) {
    if (stepId === failedStep) {
      result[stepId] = { status: "failed", error: errorMessage };
      seenFailure = true;
    } else if (!seenFailure) {
      result[stepId] = { status: "completed" };
    }
  }

  return result;
}
