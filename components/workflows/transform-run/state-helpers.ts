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
 *
 * @param row - Target row
 * @returns The resolved result
 * @author Maruf Bepary
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

/**
 * Resolves initial step status.
 *
 * @param index - Target index
 * @param status - Current status value
 * @param currentStepIndex - Target current step index
 * @returns The resolved result
 * @author Maruf Bepary
 */
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
 * Supported output mapping representations for step-to-attachment attribution.
 */
export type StepOutputMapping =
  | Record<number, string>
  | Array<{ id: string; name?: string; stepIndex?: number }>;

/**
 * Parses zero-based step index from artifact name (e.g. step-1-output.xlsx).
 */
function parseStepIndexFromName(name?: string, stepsCount = 0): number | null {
  if (!name) return null;
  const match = name.match(/^step-(\d+)-/i);
  if (!match) return null;
  const idx = parseInt(match[1], 10) - 1;
  return idx >= 0 && idx < stepsCount ? idx : null;
}

/**
 * Resolves step outputs from array format.
 */
function resolveArrayStepOutputs(
  items: Array<{ id: string; name?: string; stepIndex?: number }>,
  stepsCount: number,
  map: Map<number, string>,
): void {
  for (const item of items) {
    if (
      typeof item.stepIndex === "number" &&
      item.stepIndex >= 0 &&
      item.stepIndex < stepsCount
    ) {
      map.set(item.stepIndex, item.id);
      continue;
    }
    const idx = parseStepIndexFromName(item.name, stepsCount);
    if (idx !== null) {
      map.set(idx, item.id);
    }
  }
}

/**
 * Resolves step outputs from record mapping format.
 */
function resolveRecordStepOutputs(
  record: Record<number, string>,
  stepsCount: number,
  map: Map<number, string>,
): void {
  for (const [key, id] of Object.entries(record)) {
    const idx = Number(key);
    if (!Number.isNaN(idx) && idx >= 0 && idx < stepsCount) {
      map.set(idx, id);
    }
  }
}

/**
 * Builds step-to-output-attachment-id index map from explicit step outputs.
 *
 * @param stepsCount - Total number of workflow steps
 * @param stepOutputs - Target step output mapping
 * @returns The resolved result
 * @author Maruf Bepary
 */
function resolveStepOutputMap(
  stepsCount: number,
  stepOutputs?: StepOutputMapping,
): Map<number, string> | null {
  if (!stepOutputs) return null;
  const map = new Map<number, string>();
  if (Array.isArray(stepOutputs)) {
    resolveArrayStepOutputs(stepOutputs, stepsCount, map);
  } else {
    resolveRecordStepOutputs(stepOutputs, stepsCount, map);
  }
  return map;
}

/**
 * Constructs initial step states map based on run execution status.
 *
 * @param stepsCount - Total number of workflow steps
 * @param status - Current status value
 * @param currentStepIndex - Target current step index
 * @param outputAttachmentIds - Target output attachment ids
 * @param stepOutputs - Optional step-to-attachment mapping to avoid index shifting
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function buildInitialStepStates(
  stepsCount: number,
  status: TransformRunStatus,
  currentStepIndex: number | null,
  outputAttachmentIds: string[],
  stepOutputs?: StepOutputMapping,
): Record<number, StepState> {
  const initial: Record<number, StepState> = {};
  const outputMap = resolveStepOutputMap(stepsCount, stepOutputs);
  for (let i = 0; i < stepsCount; i++) {
    const stepStatus = resolveInitialStepStatus(i, status, currentStepIndex);
    const stepOutputId = outputMap ? outputMap.get(i) : outputAttachmentIds[i];
    initial[i] =
      stepStatus === "pending"
        ? { status: "pending" }
        : { status: stepStatus, outputAttachmentId: stepOutputId };
  }
  return initial;
}

/**
 * Resolves default selected step index on initial page load.
 *
 * @param stepsCount - Total number of workflow steps
 * @param status - Current status value
 * @param currentStepIndex - Target current step index
 * @returns The resolved result
 * @author Maruf Bepary
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
 *
 * @param prev - Target prev
 * @param stepIndex - Target step index
 * @returns The resolved result
 * @author Maruf Bepary
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
 *
 * @param prev - Target prev
 * @param stepIndex - Target step index
 * @param call - Target call
 * @returns The resolved result
 * @author Maruf Bepary
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
 *
 * @param prev - Target prev
 * @param stepIndex - Target step index
 * @param result - Target result
 * @returns The resolved result
 * @author Maruf Bepary
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
 *
 * @param prev - Target prev
 * @param stepIndex - Target step index
 * @param data - Target data
 * @returns The resolved result
 * @author Maruf Bepary
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
 *
 * @param prev - Target prev
 * @param stepIndex - Target step index
 * @returns The resolved result
 * @author Maruf Bepary
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

/**
 * Finds latest output attachment.
 *
 * @param startIndex - Target start index
 * @param stepStates - Execution state mapping for workflow steps
 * @returns The resolved result
 * @author Maruf Bepary
 */
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
 *
 * @param selectedStepIndex - Target selected step index
 * @param stepStates - Execution state mapping for workflow steps
 * @param inputAttachmentIds - Target input attachment ids
 * @returns The resolved result
 * @author Maruf Bepary
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

/**
 * Resolves step data spreadsheet.
 *
 * @param stepData - Target step data
 * @param stepName - Target step name
 * @param stepIndex - Target step index
 * @returns The resolved result
 * @author Maruf Bepary
 */
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

/**
 * Resolves cached artifact.
 *
 * @param targetAttachmentId - Target target attachment id
 * @param artifactCache - Target artifact cache
 * @returns The resolved result
 * @author Maruf Bepary
 */
function resolveCachedArtifact(
  targetAttachmentId: string | null | undefined,
  artifactCache: Record<string, ArtifactData> | undefined,
): ArtifactData | null {
  if (!targetAttachmentId || !artifactCache) return null;
  return artifactCache[targetAttachmentId] ?? null;
}

/**
 * Resolves preview artifact data from in-memory state or cache.
 *
 * @param selectedStepIndex - Target selected step index
 * @param stepStates - Execution state mapping for workflow steps
 * @param stepName - Target step name
 * @param targetAttachmentId - Target target attachment id
 * @param artifactCache - Target artifact cache
 * @returns The resolved result
 * @author Maruf Bepary
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
 *
 * @param artifactCache - Target artifact cache
 * @param targetAttachmentId - Target target attachment id
 * @param stepStates - Execution state mapping for workflow steps
 * @returns The resolved result
 * @author Maruf Bepary
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
