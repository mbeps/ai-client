import { eq } from "drizzle-orm";
import { INTERNAL_TOOL_IDS } from "@/config/tools";
import { db } from "@/drizzle/db";
import { transformAgent, transformRun } from "@/drizzle/schema";
import { transformRunChannel } from "@/lib/inngest/channels";
import { inngest } from "@/lib/inngest/client";
import { getLogger } from "@/lib/logger";
import { buildFileContext } from "@/lib/transform/build-file-context";
import { validateStepOrders } from "@/lib/transform/lifecycle-service";
import { loadTransformContext } from "@/lib/transform/load-transform-context";
import { runTransformSteps } from "@/lib/transform/run-steps";
import { transformStepSchema } from "@/schemas/workflows/transform-agent";
import type { TransformStep } from "@/types/transform/transform-step";

const log = getLogger(["inngest", "transform", "run"]);

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

    const emit = async (data: any) => {
      try {
        await inngest.realtime.publish(trCh.progress, data);
      } catch (err) {
        log.warn("Failed to publish realtime event (runId: {runId}): {err}", {
          runId,
          err: err instanceof Error ? err.message : String(err),
        });
      }
    };

    // 1. Load run and agent row
    const initData = await step.run("initialize-run", async () => {
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

      let parsedRaw: unknown;
      try {
        parsedRaw = JSON.parse(agentRow.steps);
      } catch {
        const errorMsg = `Invalid JSON in steps for agent ${agentRow.id}`;
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
        throw new Error(errorMsg);
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
        const errorMsg = `Invalid transform steps for agent ${agentRow.id}: ${parsedSteps.error.message}`;
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
        throw new Error(errorMsg);
      }

      const steps: TransformStep[] = [...parsedSteps.data].sort(
        (a, b) => a.order - b.order,
      );
      validateStepOrders(steps.map((s) => s.order));

      return {
        runRow,
        agentRow,
        steps,
      };
    });

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

    while (currentStepIndex < steps.length) {
      const stepIdx = currentStepIndex;

      const stepExecutionResult = await step.run(
        `execute-step-${stepIdx}`,
        async () => {
          const [currentRun] = await db
            .select()
            .from(transformRun)
            .where(eq(transformRun.id, runId));

          if (!currentRun || currentRun.status === "failed") {
            log.info(
              "Transform run or agent deleted; terminating step execution",
              { runId },
            );
            return { success: false, cancelled: true };
          }

          const [currentAgent] = await db
            .select()
            .from(transformAgent)
            .where(eq(transformAgent.id, currentRun.agentId));

          if (!currentAgent) {
            log.info(
              "Transform run or agent deleted; terminating step execution",
              { runId },
            );
            return { success: false, cancelled: true };
          }

          let initialAttachmentRows: any[] = [];
          if (currentAgent.requiresFileUpload) {
            const currentOutputIds: string[] =
              currentRun.outputAttachmentIds ?? [];
            const inputIds: string[] = currentRun.inputAttachmentIds ?? [];
            const stageIds =
              stepIdx > 0 && currentOutputIds.length > 0
                ? [currentOutputIds[currentOutputIds.length - 1]]
                : inputIds;

            const ctx = await buildFileContext(stageIds, userId);
            initialAttachmentRows = ctx.attachmentRows;
          }

          let anyArtifactToolSelected = false;
          try {
            const parsedSteps: TransformStep[] = JSON.parse(currentAgent.steps);
            anyArtifactToolSelected = parsedSteps.some((s) =>
              s.toolIds?.includes(INTERNAL_TOOL_IDS.MANAGE_ARTIFACT),
            );
          } catch {}

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
            const result = await runTransformSteps({
              steps,
              startFromStep: stepIdx,
              runRow: currentRun,
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

            return result;
          } finally {
            await mcpCleanup();
          }
        },
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
      };

      finalOutputAttachmentIds = resultData.currentOutputAttachmentIds ?? [];

      if (resultData.paused) {
        // Step hit a human review gate. Wait for approval event.
        log.info(
          "Workflow waiting for review approval (runId: {runId}, step: {stepIdx})",
          { runId, stepIdx },
        );

        await step.waitForEvent("wait-for-review-approval", {
          event: "workflows/transform.approved",
          match: "data.runId",
          timeout: "7d",
        });

        // Review approved: resume from next step
        currentStepIndex = stepIdx + 1;

        await step.run(`resume-after-review-${stepIdx}`, async () => {
          await db
            .update(transformRun)
            .set({ status: "running", updatedAt: new Date() })
            .where(eq(transformRun.id, runId));
        });
      } else {
        // All steps finished
        break;
      }
    }

    // Mark completed
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

    return { success: true, completed: true };
  },
);
