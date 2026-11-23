import { eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { workflowRun } from "@/drizzle/schemas/workflow-schema";
import { InvalidArtifactFormatError } from "@/lib/error/invalid-artifact-format-error";
import type { WorkflowStreamEvent } from "@/lib/inngest/workflow-run-channel";
import type { AttachmentRow } from "@/lib/workflows/build-file-context";
import { persistWorkflowArtifact } from "@/lib/workflows/persist-artifact";
import { applyDownloadFallbackIfMutated } from "@/lib/workflows/step-workbook-fallback";

async function persistExplicitStepArtifact(
  artifact: Record<string, unknown>,
  stepIndex: number,
  userId: string,
  runId: string,
  stepName: string,
  emit: (data: WorkflowStreamEvent) => Promise<void> | void,
) {
  try {
    const persisted = await persistWorkflowArtifact(
      { kind: "artifact", artifact, stepIndex },
      userId,
      runId,
    );
    return { success: true as const, persisted };
  } catch (err) {
    if (err instanceof InvalidArtifactFormatError) {
      const msg = `Step "${stepName}" produced invalid spreadsheet artifact: ${err.message}`;
      await db
        .update(workflowRun)
        .set({ status: "failed", errorMessage: msg })
        .where(eq(workflowRun.id, runId));

      await emit({
        type: "error",
        message: msg,
        code: err.code,
      });
      return { success: false as const, error: err };
    }
    throw err;
  }
}

function applyPersistedOutput(
  persisted: { attachmentRow: AttachmentRow; outputAttachmentIds: string[] },
  currentOutputIds: string[],
) {
  return {
    currentOutputIds: Array.from(
      new Set([...currentOutputIds, ...persisted.outputAttachmentIds]),
    ),
    currentRows: [persisted.attachmentRow],
    stepOutputAttachmentId: persisted.attachmentRow.id,
  };
}

/** Parameters for `handleStepArtifactOutput`. */
export interface HandleStepArtifactOutputParams {
  stepName: string;
  stepIndex: number;
  userId: string;
  runId: string;
  stepArtifact: Record<string, unknown> | null;
  stepHasSpreadsheetMutations: boolean;
  activeWorkbookFilePath: string | null;
  currentOutputAttachmentIds: string[];
  currentAttachmentRows: AttachmentRow[];
  runMcpTools: Record<string, any>;
  runToolSourceMap: Record<string, string>;
  stepServerNames: Set<string>;
  emit: (data: WorkflowStreamEvent) => Promise<void> | void;
}

/** Return shape of `handleStepArtifactOutput`. */
export interface HandleStepArtifactOutputResult {
  success: boolean;
  stepArtifact: Record<string, unknown> | null;
  stepOutputAttachmentId?: string;
  currentOutputAttachmentIds: string[];
  currentAttachmentRows: AttachmentRow[];
  activeWorkbookFilePath: string | null;
}

/**
 * Persists artifacts produced during an AI step, applies workbook download fallback if needed,
 * and fails closed if spreadsheet mutations occurred without persisted output.
 */
export async function handleStepArtifactOutput(
  params: HandleStepArtifactOutputParams,
): Promise<HandleStepArtifactOutputResult> {
  const {
    stepName,
    stepIndex,
    userId,
    runId,
    stepArtifact,
    stepHasSpreadsheetMutations,
    activeWorkbookFilePath,
    currentOutputAttachmentIds,
    currentAttachmentRows,
    runMcpTools,
    runToolSourceMap,
    stepServerNames,
    emit,
  } = params;

  let currentOutputIds = [...currentOutputAttachmentIds];
  let currentRows = [...currentAttachmentRows];
  let currentWorkbookPath = activeWorkbookFilePath;
  let artifact = stepArtifact;
  let stepOutputAttachmentId: string | undefined;
  let stepPersistedSpreadsheetOutput = false;

  const hasValidArtifact =
    artifact !== null &&
    typeof artifact.type === "string" &&
    typeof artifact.content === "string";

  if (artifact && hasValidArtifact) {
    const persistResult = await persistExplicitStepArtifact(
      artifact,
      stepIndex,
      userId,
      runId,
      stepName,
      emit,
    );
    if (!persistResult.success) {
      return {
        success: false,
        stepArtifact: artifact,
        currentOutputAttachmentIds: currentOutputIds,
        currentAttachmentRows: currentRows,
        activeWorkbookFilePath: currentWorkbookPath,
      };
    }
    if (persistResult.persisted) {
      const applied = applyPersistedOutput(
        persistResult.persisted,
        currentOutputIds,
      );
      currentOutputIds = applied.currentOutputIds;
      currentRows = applied.currentRows;
      stepOutputAttachmentId = applied.stepOutputAttachmentId;
      stepPersistedSpreadsheetOutput = true;
      currentWorkbookPath = null;
    }
  }

  const fallbackResult = await applyDownloadFallbackIfMutated({
    shouldTry: stepHasSpreadsheetMutations && !stepPersistedSpreadsheetOutput,
    currentWorkbookPath,
    stepIndex,
    stepName,
    userId,
    runId,
    defaultFilename:
      currentRows[0]?.name || `step-${stepIndex + 1}-output.xlsx`,
    runMcpTools,
    runToolSourceMap,
    stepServerNames,
    currentOutputIds,
    artifact,
    applyPersistedOutput,
  });

  if (fallbackResult) {
    currentOutputIds = fallbackResult.currentOutputIds;
    currentRows = fallbackResult.currentRows;
    stepOutputAttachmentId = fallbackResult.stepOutputAttachmentId;
    artifact = fallbackResult.artifact;
    stepPersistedSpreadsheetOutput = true;
  }

  if (stepHasSpreadsheetMutations && !stepPersistedSpreadsheetOutput) {
    const errorMessage = `Step "${stepName}" changed workbook data, but no spreadsheet artifact output was persisted. Refusing to complete with stale output.`;
    await db
      .update(workflowRun)
      .set({ status: "failed", errorMessage })
      .where(eq(workflowRun.id, runId));
    await emit({ type: "error", message: errorMessage });

    return {
      success: false,
      stepArtifact: artifact,
      currentOutputAttachmentIds: currentOutputIds,
      currentAttachmentRows: currentRows,
      activeWorkbookFilePath: currentWorkbookPath,
    };
  }

  return {
    success: true,
    stepArtifact: artifact,
    stepOutputAttachmentId,
    currentOutputAttachmentIds: currentOutputIds,
    currentAttachmentRows: currentRows,
    activeWorkbookFilePath: currentWorkbookPath,
  };
}
