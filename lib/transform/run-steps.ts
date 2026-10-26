import { eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { transformRun } from "@/drizzle/schemas/transform-agent-schema";
import { getLogger } from "@/lib/logger";
import type { AttachmentRow } from "@/lib/transform/build-file-context";
import { handleStepArtifactOutput } from "@/lib/transform/step-artifact-output";
import {
  executeStepModelTurn,
  handleStepExecutionError,
  type StepModelTurnResult,
} from "@/lib/transform/step-execution-turn";
import { buildStepSystemPrompt } from "@/lib/transform/step-system-prompt";
import {
  filterStepTools,
  resolveStepFileContext,
} from "@/lib/transform/step-tool-filtering";
import type { ResolvedProvider } from "@/types/provider/resolved-provider";
import type { SkillSummary } from "@/types/skill/skill";
import type { SkillRow } from "@/types/skill/skill-row";
import type { TransformStep } from "@/types/transform/transform-step";

const log = getLogger(["app", "transform", "steps"]);

export interface RunTransformStepsOptions {
  steps: TransformStep[];
  startFromStep: number;
  runRow: { id: string; outputAttachmentIds?: string[] | null };
  agentRow: {
    id: string;
    name: string;
    description: string | null;
    globalContext: string | null;
    requiresFileUpload: boolean;
    tools: string[] | null;
    modelId: string | null;
  };
  userId: string;
  allServers: any[];
  resolvedProvider: ResolvedProvider;
  kbContext: string;
  availableSkills?: SkillSummary[];
  selectedSkills?: SkillRow[];
  runMcpTools: Record<string, any>;
  runToolSourceMap: Record<string, string>;
  initialAttachmentRows: AttachmentRow[];
  emit: (data: any) => void;
}

interface PrepareStepExecutionParams {
  step: TransformStep;
  agentRow: RunTransformStepsOptions["agentRow"];
  allServers: any[];
  runMcpTools: Record<string, any>;
  runToolSourceMap: Record<string, string>;
  userId: string;
  skillCatalog: SkillSummary[];
  preloadedSkills: SkillRow[];
  kbContext: string;
  activeWorkbookFilePath: string | null;
  currentAttachmentRows: AttachmentRow[];
}

interface StepExecutionPreparation {
  filteredTools: Record<string, any>;
  toolSourceMap: Record<string, string>;
  stepServerNames: Set<string>;
  systemPrompt: string;
}

async function prepareStepExecution(
  params: PrepareStepExecutionParams,
): Promise<StepExecutionPreparation> {
  const { filteredTools, toolSourceMap, stepServerNames } =
    filterStepTools(params);

  const fileContext = await resolveStepFileContext(
    params.activeWorkbookFilePath,
    params.currentAttachmentRows,
    params.userId,
  );

  const systemPrompt = buildStepSystemPrompt({
    step: params.step,
    agentRow: params.agentRow,
    filteredTools,
    skillCatalog: params.skillCatalog,
    preloadedSkills: params.preloadedSkills,
    kbContext: params.kbContext,
    fileContext,
  });

  return {
    filteredTools,
    toolSourceMap,
    stepServerNames,
    systemPrompt,
  };
}

/**
 * Executes a transform agent run step-by-step with state accumulation and persistence.
 * Orchestrates the flow: prepare execution context → invoke model turn → persist outputs.
 * Emits real-time events (step-start, tool-call, step-complete, error) for UI streaming.
 * Handles spreadsheet mutations, file uploads, and artifact persistence.
 * Rate limit errors trigger retry logic and emit retryable events.
 *
 * @param options - Step execution configuration (steps, run/agent rows, MCP tools, etc.)
 * @returns Object indicating success, pause status, and current output attachment IDs
 * @throws {RateLimitError} On rate limit (triggers retry in caller)
 * @author Maruf Bepary
 */
export async function runTransformSteps({
  steps,
  startFromStep,
  runRow,
  agentRow,
  userId,
  allServers,
  resolvedProvider,
  kbContext,
  availableSkills,
  selectedSkills,
  runMcpTools,
  runToolSourceMap,
  initialAttachmentRows,
  emit,
}: RunTransformStepsOptions) {
  const skillCatalog = availableSkills ?? [];
  const preloadedSkills = selectedSkills ?? [];
  let currentAttachmentRows = initialAttachmentRows;
  let activeWorkbookFilePath: string | null = null;
  let currentOutputAttachmentIds: string[] = [
    ...(runRow.outputAttachmentIds ?? []),
  ];

  for (let i = startFromStep; i < steps.length; i++) {
    const step = steps[i];

    try {
      await db
        .update(transformRun)
        .set({ updatedAt: new Date() })
        .where(eq(transformRun.id, runRow.id));
    } catch {
      log.warn("Heartbeat update failed (runId: {runId})", {
        runId: runRow.id,
        userId,
      });
    }

    await db
      .update(transformRun)
      .set({ currentStepIndex: i })
      .where(eq(transformRun.id, runRow.id));

    emit({
      type: "transform-step-start",
      runId: runRow.id,
      stepIndex: i,
      stepName: step.name,
      total: steps.length,
    });

    log.info(
      "Step started (runId: {runId}, stepIndex: {stepIndex}, stepName: {stepName})",
      {
        runId: runRow.id,
        stepIndex: i,
        stepName: step.name,
        userId,
      },
    );

    const { filteredTools, toolSourceMap, stepServerNames, systemPrompt } =
      await prepareStepExecution({
        step,
        agentRow,
        allServers,
        runMcpTools,
        runToolSourceMap,
        userId,
        skillCatalog,
        preloadedSkills,
        kbContext,
        activeWorkbookFilePath,
        currentAttachmentRows,
      });

    let turnResult: StepModelTurnResult;
    try {
      turnResult = await executeStepModelTurn({
        resolvedProvider,
        filteredTools,
        toolSourceMap,
        systemPrompt,
        currentAttachmentRows,
        activeWorkbookFilePath,
        runId: runRow.id,
        stepIndex: i,
        userId,
        emit,
      });
    } catch (stepErr) {
      await handleStepExecutionError(stepErr, step.name, runRow.id, emit);
      return { success: false };
    }

    activeWorkbookFilePath = turnResult.activeWorkbookFilePath;

    const outputResult = await handleStepArtifactOutput({
      step,
      stepIndex: i,
      userId,
      runId: runRow.id,
      stepArtifact: turnResult.stepArtifact,
      stepHasSpreadsheetMutations: turnResult.stepHasSpreadsheetMutations,
      activeWorkbookFilePath,
      currentOutputAttachmentIds,
      currentAttachmentRows,
      runMcpTools,
      runToolSourceMap,
      stepServerNames,
      emit,
    });

    if (!outputResult.success) {
      return { success: false };
    }

    currentOutputAttachmentIds = outputResult.currentOutputAttachmentIds;
    currentAttachmentRows = outputResult.currentAttachmentRows;
    activeWorkbookFilePath = outputResult.activeWorkbookFilePath;

    emit({
      type: "transform-step-complete",
      runId: runRow.id,
      stepIndex: i,
      summary: turnResult.stepSummary,
      stepData: {},
      artifact: outputResult.stepArtifact,
      outputAttachmentId: outputResult.stepOutputAttachmentId,
      outputAttachmentIds: currentOutputAttachmentIds,
    });

    log.info("Step completed (runId: {runId}, stepIndex: {stepIndex})", {
      runId: runRow.id,
      stepIndex: i,
      userId,
    });

    if (step.requiresReview) {
      await db
        .update(transformRun)
        .set({ status: "awaiting_review", currentStepIndex: i })
        .where(eq(transformRun.id, runRow.id));

      emit({
        type: "transform-review-required",
        runId: runRow.id,
        stepIndex: i,
      });

      log.info(
        "Paused for human review (runId: {runId}, stepIndex: {stepIndex})",
        { runId: runRow.id, stepIndex: i, userId },
      );

      return { success: true, paused: true, currentOutputAttachmentIds };
    }
  }

  return { success: true, paused: false, currentOutputAttachmentIds };
}
