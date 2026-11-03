import { eq } from "drizzle-orm";
import { INTERNAL_TOOL_IDS } from "@/config/tools";
import { db } from "@/drizzle/db";
import {
  transformAgent,
  transformRun,
} from "@/drizzle/schemas/transform-agent-schema";
import { inngest } from "@/lib/inngest/client";
import {
  type TransformStreamEvent,
  transformRunChannel,
} from "@/lib/inngest/transform-run-channel";
import { getLogger } from "@/lib/logger";
import { buildFileContext } from "@/lib/transform/build-file-context";
import { validateStepOrders } from "@/lib/transform/lifecycle-service";
import { loadTransformContext } from "@/lib/transform/load-transform-context";
import { runTransformSteps } from "@/lib/transform/run-steps";
import { transformStepSchema } from "@/schemas/workflows/transform-agent";
import type { TransformStep } from "@/types/transform/transform-step";

const log = getLogger(["inngest", "transform", "run"]);

/**
 * Parses and validates steps JSON against transformStepSchema and order rules.
 *
 * @param stepsJson - Raw JSON string of steps
 * @param agentId - Transform agent identifier
 * @returns Sorted and validated array of TransformStep
 * @author Maruf Bepary
 */
function parseAndValidateAgentSteps(
  stepsJson: string,
  agentId: string,
): TransformStep[] {
  let parsedRaw: unknown;
  try {
    parsedRaw = JSON.parse(stepsJson);
  } catch {
    throw new Error(`Invalid JSON in steps for agent ${agentId}`);
  }

  const normalizedRaw = Array.isArray(parsedRaw)
    ? parsedRaw.map((s) =>
        typeof s === "object" && s !== null
          ? {
              mcpServerIds: [],
              toolIds: [],
              order: 0,
              requiresReview: false,
              prompt: "",
              ...s,
            }
          : s,
      )
    : parsedRaw;

  const parsedSteps = transformStepSchema.array().safeParse(normalizedRaw);
  if (!parsedSteps.success) {
    throw new Error(
      `Invalid transform steps for agent ${agentId}: ${parsedSteps.error.message}`,
    );
  }

  const steps: TransformStep[] = [...parsedSteps.data].sort(
    (a, b) => a.order - b.order,
  );
  validateStepOrders(steps.map((s) => s.order));
  return steps;
}

/**
 * Resolves initial attachment rows for a transform step based on upload requirements.
 *
 * @param currentAgent - Agent row
 * @param currentRun - Run row
 * @param stepIdx - Step index
 * @param userId - Target user identifier
 * @returns Attachment rows array
 * @author Maruf Bepary
 */
async function resolveStepAttachmentRows(
  currentAgent: typeof transformAgent.$inferSelect,
  currentRun: typeof transformRun.$inferSelect,
  stepIdx: number,
  userId: string,
): Promise<any[]> {
  if (!currentAgent.requiresFileUpload) return [];
  const currentOutputIds: string[] = currentRun.outputAttachmentIds ?? [];
  const inputIds: string[] = currentRun.inputAttachmentIds ?? [];
  const stageIds =
    stepIdx > 0 && currentOutputIds.length > 0
      ? [currentOutputIds[currentOutputIds.length - 1]]
      : inputIds;

  const ctx = await buildFileContext(stageIds, userId);
  return ctx.attachmentRows;
}

/**
 * Checks whether any step in the agent configuration selects artifact management.
 *
 * @param agentStepsJson - Raw JSON string of steps
 * @returns True if manage_artifact tool is selected in any step
 * @author Maruf Bepary
 */
function checkAnyArtifactToolSelected(agentStepsJson: string): boolean {
  try {
    const parsedSteps: TransformStep[] = JSON.parse(agentStepsJson);
    return parsedSteps.some((s) =>
      s.toolIds?.includes(INTERNAL_TOOL_IDS.MANAGE_ARTIFACT),
    );
  } catch {
    return false;
  }
}

/**
 * Executes the initialize-run step: loads rows, marks running, parses steps.
 *
 * @param step - Inngest step context
 * @param runId - Run identifier
 * @param emit - Realtime event emitter
 * @returns Initialized runRow, agentRow, and parsed steps
 * @author Maruf Bepary
 */
async function initializeTransformRun(
  step: any,
  runId: string,
  emit: (data: TransformStreamEvent) => Promise<void>,
) {
  return step.run("initialize-run", async () => {
    const [runRow] = await db
      .select()
      .from(transformRun)
      .where(eq(transformRun.id, runId));

    if (!runRow) throw new Error(`Run ${runId} not found`);

    const [agentRow] = await db
      .select()
      .from(transformAgent)
      .where(eq(transformAgent.id, runRow.agentId));

    if (!agentRow) throw new Error(`Agent ${runRow.agentId} not found`);

    await db
      .update(transformRun)
      .set({ status: "running", errorMessage: null, updatedAt: new Date() })
      .where(eq(transformRun.id, runId));

    await emit({ type: "transform-start", runId });

    try {
      const steps = parseAndValidateAgentSteps(agentRow.steps, agentRow.id);
      return { runRow, agentRow, steps };
    } catch (err) {
      const errorMsg = (err as Error).message;
      await db
        .update(transformRun)
        .set({
          status: "failed",
          errorMessage: errorMsg,
          updatedAt: new Date(),
        })
        .where(eq(transformRun.id, runId));
      await emit({
        type: "error",
        message: errorMsg,
        code: "INVALID_AGENT_STEPS",
      });
      throw err;
    }
  });
}

/**
 * Executes a single transform step inside an Inngest step wrapper.
 *
 * @param step - Inngest step context
 * @param runId - Run identifier
 * @param userId - Requesting user identifier
 * @param stepIdx - Current step index
 * @param steps - Full workflow steps array
 * @param activeWorkbookFilePath - In-memory workbook path across steps
 * @param emit - Realtime event emitter
 * @returns Step execution result
 * @author Maruf Bepary
 */
async function executeSingleTransformStep(
  step: any,
  runId: string,
  userId: string,
  stepIdx: number,
  steps: TransformStep[],
  activeWorkbookFilePath: string | null,
  emit: (data: TransformStreamEvent) => Promise<void>,
) {
  return step.run(`execute-step-${stepIdx}`, async () => {
    const [currentRun] = await db
      .select()
      .from(transformRun)
      .where(eq(transformRun.id, runId));

    if (!currentRun || currentRun.status === "failed") {
      log.info("Transform run or agent deleted; terminating step execution", {
        runId,
      });
      return { success: false, cancelled: true };
    }

    const [currentAgent] = await db
      .select()
      .from(transformAgent)
      .where(eq(transformAgent.id, currentRun.agentId));

    if (!currentAgent) {
      log.info("Transform run or agent deleted; terminating step execution", {
        runId,
      });
      return { success: false, cancelled: true };
    }

    const initialAttachmentRows = await resolveStepAttachmentRows(
      currentAgent,
      currentRun,
      stepIdx,
      userId,
    );

    const anyArtifactToolSelected = checkAnyArtifactToolSelected(
      currentAgent.steps,
    );

    const {
      allServers,
      resolvedProvider,
      kbContext,
      mcpTools,
      toolSourceMap,
      mcpCleanup,
      availableSkills,
      selectedSkills,
    } = await loadTransformContext({
      userId,
      agentRow: currentAgent,
      anyArtifactToolSelected,
    });

    try {
      return await runTransformSteps({
        steps,
        startFromStep: stepIdx,
        singleStep: true,
        initialWorkbookFilePath: activeWorkbookFilePath,
        runRow: currentRun,
        dryRun: currentRun.dryRun,
        agentRow: currentAgent,
        userId,
        allServers,
        resolvedProvider,
        kbContext,
        availableSkills,
        selectedSkills,
        runMcpTools: mcpTools,
        runToolSourceMap: toolSourceMap,
        initialAttachmentRows,
        emit,
      });
    } finally {
      await mcpCleanup();
    }
  });
}

/**
 * Handles human review approval gate: waits for event and resumes or fails on timeout.
 *
 * @param step - Inngest step context
 * @param runId - Run identifier
 * @param stepIdx - Step index waiting for review
 * @param emit - Realtime event emitter
 * @returns True if approved, false if timed out
 * @author Maruf Bepary
 */
async function handleTransformReviewGate(
  step: any,
  runId: string,
  stepIdx: number,
  emit: (data: TransformStreamEvent) => Promise<void>,
): Promise<boolean> {
  log.info(
    "Workflow waiting for review approval (runId: {runId}, step: {stepIdx})",
    { runId, stepIdx },
  );

  const approvalEvent = await step.waitForEvent(
    `wait-for-review-approval-${stepIdx}`,
    {
      event: "workflows/transform.approved",
      match: "data.runId",
      timeout: "7d",
    },
  );

  if (!approvalEvent) {
    await step.run(`fail-review-timeout-${stepIdx}`, async () => {
      await db
        .update(transformRun)
        .set({
          status: "failed",
          errorMessage: "Step review approval timed out",
          updatedAt: new Date(),
        })
        .where(eq(transformRun.id, runId));

      await emit({
        type: "error",
        message: "Step review approval timed out",
      });
    });
    return false;
  }

  await step.run(`resume-after-review-${stepIdx}`, async () => {
    await db
      .update(transformRun)
      .set({ status: "running", updatedAt: new Date() })
      .where(eq(transformRun.id, runId));
  });

  return true;
}

/**
 * Finalizes successful transform run completion in database and publishes complete event.
 *
 * @param step - Inngest step context
 * @param runId - Run identifier
 * @param userId - Target user identifier
 * @param finalOutputAttachmentIds - Output attachment IDs from steps
 * @param emit - Realtime event emitter
 * @author Maruf Bepary
 */
async function finalizeTransformRun(
  step: any,
  runId: string,
  userId: string,
  finalOutputAttachmentIds: string[],
  emit: (data: TransformStreamEvent) => Promise<void>,
): Promise<void> {
  await step.run("finalize-completed-run", async () => {
    const [finalRun] = await db
      .select()
      .from(transformRun)
      .where(eq(transformRun.id, runId));

    const outputIds =
      finalOutputAttachmentIds.length > 0
        ? finalOutputAttachmentIds
        : (finalRun?.outputAttachmentIds ?? []);

    await db
      .update(transformRun)
      .set({
        status: "completed",
        outputAttachmentIds: outputIds,
        updatedAt: new Date(),
      })
      .where(eq(transformRun.id, runId));

    await emit({
      type: "transform-complete",
      runId,
      outputAttachmentIds: outputIds,
    });

    log.info("Transform run successfully completed (runId: {runId})", {
      runId,
      userId,
    });
  });
}

/**
 * Inngest durable function executing spreadsheet transform agent workflows.
 * Checkpoints step execution, publishes real-time progress via Inngest Realtime,
 * survives browser disconnects/reloads, and handles review gates via waitForEvent.
 *
 * @author Maruf Bepary
 */
export const executeTransformRun = inngest.createFunction(
  {
    id: "run-transform-workflow",
    retries: 0,
    concurrency: [{ key: "event.data.runId", limit: 1 }],
    triggers: [{ event: "workflows/transform.execute" }],
    cancelOn: [
      {
        event: "workflows/transform.cancel",
        if: "async.data.runId == event.data.runId",
      },
    ],
  },
  async ({ event, step }) => {
    const { runId, userId } = event.data;
    const trCh = transformRunChannel({ runId });

    const emit = async (data: TransformStreamEvent) => {
      try {
        await inngest.realtime.publish(trCh.progress, data);
      } catch (err) {
        log.warn("Failed to publish realtime event (runId: {runId}): {err}", {
          runId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    };

    const initData = await initializeTransformRun(step, runId, emit);
    const { steps } = initData;

    if (steps.length === 0) {
      await step.run("complete-empty-run", async () => {
        await db
          .update(transformRun)
          .set({ status: "completed", updatedAt: new Date() })
          .where(eq(transformRun.id, runId));
        await emit({
          type: "transform-complete",
          runId,
          outputAttachmentIds: [],
        });
      });
      return { success: true, completed: true };
    }

    let currentStepIndex = event.data.startFromStep ?? 0;
    let finalOutputAttachmentIds: string[] = [];
    let activeWorkbookFilePath: string | null = null;

    while (currentStepIndex < steps.length) {
      const stepIdx = currentStepIndex;

      const stepExecutionResult = await executeSingleTransformStep(
        step,
        runId,
        userId,
        stepIdx,
        steps,
        activeWorkbookFilePath,
        emit,
      );

      if (!stepExecutionResult?.success) {
        if ((stepExecutionResult as any)?.cancelled) {
          return { success: false, cancelled: true };
        }
        log.error("Step execution failed (runId: {runId}, step: {stepIdx})", {
          runId,
          stepIdx,
        });
        return { success: false };
      }

      const resultData = stepExecutionResult as {
        success: boolean;
        paused?: boolean;
        currentOutputAttachmentIds?: string[];
        activeWorkbookFilePath?: string | null;
      };

      finalOutputAttachmentIds = resultData.currentOutputAttachmentIds ?? [];
      activeWorkbookFilePath = resultData.activeWorkbookFilePath ?? null;

      if (resultData.paused) {
        const approved = await handleTransformReviewGate(
          step,
          runId,
          stepIdx,
          emit,
        );
        if (!approved) {
          return { success: false };
        }
      }

      currentStepIndex = stepIdx + 1;
    }

    await finalizeTransformRun(
      step,
      runId,
      userId,
      finalOutputAttachmentIds,
      emit,
    );

    return { success: true, completed: true };
  },
);
