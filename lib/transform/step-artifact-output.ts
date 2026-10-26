import { eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { transformRun } from "@/drizzle/schemas/transform-agent-schema";
import { InvalidArtifactFormatError } from "@/lib/error/invalid-artifact-format-error";
import type { AttachmentRow } from "@/lib/transform/build-file-context";
import { persistTransformArtifact } from "@/lib/transform/persist-artifact";
import { applyDownloadFallbackIfMutated } from "@/lib/transform/step-workbook-fallback";
import type { TransformStep } from "@/types/transform/transform-step";

/**
 * Persists an explicit artifact produced by manage_artifact tool.
 * @author Maruf Bepary
 */
async function persistExplicitStepArtifact(
  artifact: Record<string, unknown>,
  stepIndex: number,
  userId: string,
  runId: string,
  stepName: string,
  emit: (data: any) => void,
) {
  try {
    const persisted = await persistTransformArtifact(
      { kind: "artifact", artifact, stepIndex },
      userId,
      runId,
    );
    return { success: true as const, persisted };
  } catch (err) {
    if (err instanceof InvalidArtifactFormatError) {
      const msg = `Step "${stepName}" produced invalid spreadsheet artifact: ${err.message}`;
      await db
        .update(transformRun)
        .set({ status: "failed", errorMessage: msg })
        .where(eq(transformRun.id, runId));

      emit({
        type: "error",
        message: msg,
        code: err.code,
      });
      return { success: false as const, error: err };
    }
    throw err;
  }
}

/**
 * Attempts to persist artifact if it has valid structure.
 * @author Maruf Bepary
 */
async function tryPersistExplicitArtifact(
  artifact: Record<string, unknown> | null,
  stepIndex: number,
  userId: string,
  runId: string,
  stepName: string,
  emit: (data: any) => void,
) {
  const hasValidArtifact =
    artifact !== null &&
    typeof (artifact as any).type === "string" &&
    typeof (artifact as any).content === "string";

  if (!artifact || !hasValidArtifact) {
    return { success: true as const, persisted: null };
  }

  return persistExplicitStepArtifact(
    artifact,
    stepIndex,
    userId,
    runId,
    stepName,
    emit,
  );
}

/**
 * Updates output attachment IDs and current rows with newly persisted output.
 * @author Maruf Bepary
 */
function applyPersistedOutput(
  persisted: { attachmentRow: AttachmentRow; outputAttachmentIds: string[] },
  currentOutputIds: string[],
): {
  currentOutputIds: string[];
  currentRows: AttachmentRow[];
  stepOutputAttachmentId: string;
} {
  return {
    currentOutputIds: Array.from(
      new Set([...currentOutputIds, ...persisted.outputAttachmentIds]),
    ),
    currentRows: [persisted.attachmentRow],
    stepOutputAttachmentId: persisted.attachmentRow.id,
  };
}

/**
 * Marks run as failed when workbook mutations occurred without persistence.
 * @author Maruf Bepary
 */
async function failOnUnpersistedMutations(
  stepName: string,
  runId: string,
  emit: (data: any) => void,
): Promise<void> {
  const errorMessage = `Step "${stepName}" changed workbook data, but no spreadsheet artifact output was persisted. Refusing to complete with stale output.`;

  await db
    .update(transformRun)
    .set({ status: "failed", errorMessage })
    .where(eq(transformRun.id, runId));

  emit({ type: "error", message: errorMessage });
}

export interface HandleStepArtifactOutputParams {
  step: TransformStep;
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
  emit: (data: any) => void;
}

export interface HandleStepArtifactOutputResult {
  success: boolean;
  stepArtifact: Record<string, unknown> | null;
  stepOutputAttachmentId?: string;
  currentOutputAttachmentIds: string[];
  currentAttachmentRows: AttachmentRow[];
  activeWorkbookFilePath: string | null;
}

/**
 * Persists artifacts produced during a step, triggers fallback file downloads if mutations occurred,
 * and enforces the fail-safe guard against unpersisted workbook mutations.
 * @author Maruf Bepary
 */
export async function handleStepArtifactOutput(
  params: HandleStepArtifactOutputParams,
): Promise<HandleStepArtifactOutputResult> {
  const {
    step,
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

  const persistResult = await tryPersistExplicitArtifact(
    artifact,
    stepIndex,
    userId,
    runId,
    step.name,
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

  const fallbackResult = await applyDownloadFallbackIfMutated({
    shouldTry: stepHasSpreadsheetMutations && !stepPersistedSpreadsheetOutput,
    currentWorkbookPath,
    stepIndex,
    stepName: step.name,
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
    await failOnUnpersistedMutations(step.name, runId, emit);
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
