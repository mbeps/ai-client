import type { ArtifactData } from "@/types/artifact/artifact-data";
import type { TransformRun } from "@/types/transform/transform-run";
import type { TransformRunRow } from "@/types/transform/transform-run-row";
import type { TransformRunStatus } from "@/types/transform/transform-run-status";
import type {
  StepState,
  ToolCall,
  ToolResult,
} from "@/types/workflows/transform-run";

/**
 * Maps database transform run row to typed domain model.
 */
export function mapRunRowToRun(row: TransformRunRow): TransformRun {
  return {
    id: row.id,
    agentId: row.agentId,
    userId: row.userId,
    status: row.status as TransformRunStatus,
    currentStepIndex: row.currentStepIndex ?? null,
    dryRun: row.dryRun,
    inputAttachmentIds: row.inputAttachmentIds,
    outputAttachmentIds: row.outputAttachmentIds,
    errorMessage: row.errorMessage ?? "",
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function resolveInitialStepStatus(
  index: number,
  status: TransformRunStatus,
  currentStepIndex: number | null,
): StepState["status"] {
  if (status === "completed") return "completed";
  if (currentStepIndex !== null && index < currentStepIndex) return "completed";
  if (status === "awaiting_review" && index === currentStepIndex) {
    return "awaiting_review";
  }
  return "pending";
}

/**
 * Constructs initial step states map based on run execution status.
 */
export function buildInitialStepStates(
  stepsCount: number,
  status: TransformRunStatus,
  currentStepIndex: number | null,
  outputAttachmentIds: string[],
): Record<number, StepState> {
  const initial: Record<number, StepState> = {};
  for (let i = 0; i < stepsCount; i++) {
    const stepStatus = resolveInitialStepStatus(i, status, currentStepIndex);
    const stepOutputId = outputAttachmentIds[i];
    initial[i] =
      stepStatus === "pending"
        ? { status: "pending" }
        : { status: stepStatus, outputAttachmentId: stepOutputId };
  }
  return initial;
}

/**
 * Resolves default selected step index on initial page load.
 */
export function resolveInitialSelectedStep(
  stepsCount: number,
  status: TransformRunStatus,
  currentStepIndex: number | null,
): number | null {
  if (stepsCount <= 0) return null;
  if (status === "completed") return stepsCount - 1;
  if (currentStepIndex !== null) return currentStepIndex;
  return 0;
}

/**
 * Transitions steps on transform-step-start SSE event.
 */
export function applyStepStartEvent(
  prev: Record<number, StepState>,
  stepIndex: number,
): Record<number, StepState> {
  const updated = { ...prev };
  for (let i = 0; i < stepIndex; i++) {
    if (updated[i]) {
      updated[i] = { ...updated[i], status: "completed" };
    }
  }
  updated[stepIndex] = {
    status: "running",
    toolCalls: [],
    toolResults: [],
  };
  return updated;
}

/**
 * Appends a tool call event to the target step state.
 */
export function applyToolCallToStep(
  prev: Record<number, StepState>,
  stepIndex: number,
  call: ToolCall,
): Record<number, StepState> {
  const current = prev[stepIndex] || { status: "running" };
  return {
    ...prev,
    [stepIndex]: {
      ...current,
      toolCalls: [...(current.toolCalls || []), call],
    },
  };
}

/**
 * Appends a tool result event to the target step state.
 */
export function applyToolResultToStep(
  prev: Record<number, StepState>,
  stepIndex: number,
  result: ToolResult,
): Record<number, StepState> {
  const current = prev[stepIndex] || { status: "running" };
  return {
    ...prev,
    [stepIndex]: {
      ...current,
      toolResults: [...(current.toolResults || []), result],
    },
  };
}

/**
 * Updates step state with completion payload.
 */
export function applyStepCompleteToStep(
  prev: Record<number, StepState>,
  stepIndex: number,
  data: {
    summary?: string;
    stepData?: Record<string, any[]>;
    artifact?: ArtifactData | null;
    outputAttachmentId?: string;
  },
): Record<number, StepState> {
  return {
    ...prev,
    [stepIndex]: {
      ...prev[stepIndex],
      status: "completed",
      summary: data.summary,
      stepData: data.stepData,
      artifact: data.artifact ?? null,
      outputAttachmentId: data.outputAttachmentId,
    },
  };
}

/**
 * Marks target step as awaiting review.
 */
export function applyReviewRequiredToStep(
  prev: Record<number, StepState>,
  stepIndex: number,
): Record<number, StepState> {
  return {
    ...prev,
    [stepIndex]: {
      ...prev[stepIndex],
      status: "awaiting_review",
    },
  };
}

function findLatestOutputAttachment(
  startIndex: number,
  stepStates: Record<number, StepState>,
): string | null {
  for (let i = startIndex; i >= 0; i--) {
    const outputId = stepStates[i]?.outputAttachmentId;
    if (outputId) return outputId;
  }
  return null;
}

/**
 * Resolves attachment id corresponding to selected step preview.
 */
export function resolveTargetAttachmentId(
  selectedStepIndex: number | null,
  stepStates: Record<number, StepState>,
  inputAttachmentIds?: string[],
): string | null {
  if (selectedStepIndex === null) return null;
  const outputId = findLatestOutputAttachment(selectedStepIndex, stepStates);
  if (outputId) return outputId;
  if (inputAttachmentIds && inputAttachmentIds.length > 0) {
    return inputAttachmentIds[0];
  }
  return null;
}

function resolveStepDataSpreadsheet(
  stepData: Record<string, any[]>,
  stepName: string,
  stepIndex: number,
): ArtifactData | null {
  const filenames = Object.keys(stepData);
  if (filenames.length === 0) return null;
  const firstFile = filenames[0];
  return {
    type: "spreadsheet",
    title: `${stepName || "Step"} - ${firstFile}`,
    content: JSON.stringify(stepData[firstFile]),
    messageId: `step-${stepIndex}`,
  };
}

function resolveCachedArtifact(
  targetAttachmentId: string | null | undefined,
  artifactCache: Record<string, ArtifactData> | undefined,
): ArtifactData | null {
  if (!targetAttachmentId || !artifactCache) return null;
  return artifactCache[targetAttachmentId] ?? null;
}

/**
 * Resolves preview artifact data from in-memory state or cache.
 */
export function resolveStepPreviewArtifact(
  selectedStepIndex: number | null,
  stepStates: Record<number, StepState>,
  stepName?: string,
  targetAttachmentId?: string | null,
  artifactCache?: Record<string, ArtifactData>,
): ArtifactData | null {
  if (selectedStepIndex === null) return null;
  const stepState = stepStates[selectedStepIndex];
  if (!stepState) return null;

  if (stepState.artifact) return stepState.artifact;

  if (stepState.stepData) {
    const spreadsheet = resolveStepDataSpreadsheet(
      stepState.stepData,
      stepName || "Step",
      selectedStepIndex,
    );
    if (spreadsheet) return spreadsheet;
  }

  return resolveCachedArtifact(targetAttachmentId, artifactCache);
}

/**
 * Evaluates whether any artifacts or previewable attachments exist for the run.
 */
export function checkHasAnyArtifact(
  artifactCache: Record<string, ArtifactData>,
  targetAttachmentId: string | null,
  stepStates: Record<number, StepState>,
): boolean {
  if (Object.keys(artifactCache).length > 0 || targetAttachmentId !== null) {
    return true;
  }
  return Object.values(stepStates).some(
    (state) =>
      state.artifact != null ||
      (state.stepData != null && Object.keys(state.stepData).length > 0),
  );
}
