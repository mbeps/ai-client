import { and, eq, ne } from "drizzle-orm";
import { NonRetriableError } from "inngest";
import { db } from "@/drizzle/db";
import {
  workflow,
  workflowEdge,
  workflowNode,
  workflowRun,
} from "@/drizzle/schemas/workflow-schema";
import { toAppError } from "@/lib/error/to-app-error";
import { inngest } from "@/lib/inngest/client";
import {
  type WorkflowStreamEvent,
  workflowRunChannel,
} from "@/lib/inngest/workflow-run-channel";
import { getLogger } from "@/lib/logger";
import { resolveWorkflowTemplateValue } from "@/lib/workflows/compile-template";
import {
  extractLoopBodyMap,
  resolveNodeExecutionEligibility,
  validateAndSortWorkflowGraph,
} from "@/lib/workflows/dag-planner";
import {
  executeNodeWithGates,
  failWorkflowRun,
} from "@/lib/workflows/workflow-run-helpers";
import type { ArtifactData } from "@/types/artifact/artifact-data";
import type {
  WorkflowEdge,
  WorkflowNode,
  WorkflowNodeRunState,
} from "@/types/workflows/workflow";

const log = getLogger(["inngest", "workflow", "run"]);

/**
 * Durable Inngest workflow execution engine supporting branch-aware DAG topological sorting,
 * `if_condition` branch pruning, `http_request` nodes, `ai_step` nodes, and human/tool approvals.
 */
export const executeWorkflowRun = inngest.createFunction(
  {
    id: "run-workflow-automation",
    retries: 0,
    concurrency: [{ key: "event.data.runId", limit: 1 }],
    triggers: [{ event: "workflows/execute.run" }],
    cancelOn: [
      {
        event: "workflows/run.cancel",
        if: "async.data.runId == event.data.runId",
      },
    ],
    onFailure: async ({ event, error }) => {
      const { runId } = event.data.event.data as { runId?: string };
      if (!runId) return;
      const appErr = toAppError(error);
      const updated = await db
        .update(workflowRun)
        .set({
          status: "failed",
          errorMessage: appErr.message,
          updatedAt: new Date(),
        })
        .where(and(eq(workflowRun.id, runId), ne(workflowRun.status, "failed")))
        .returning({ id: workflowRun.id });

      if (updated.length === 0) return;

      const ch = workflowRunChannel({ runId });
      await inngest.realtime
        .publish(ch.progress, {
          type: "error",
          message: appErr.message,
          code: appErr.code,
        })
        .catch(() => {});
    },
  },
  async ({ event, step }) => {
    const { runId, userId } = event.data as {
      runId: string;
      workflowId: string;
      userId: string;
    };
    const wfCh = workflowRunChannel({ runId });

    const emit = async (data: WorkflowStreamEvent) => {
      try {
        await inngest.realtime.publish(wfCh.progress, data);
      } catch (err) {
        log.warn("Failed to publish workflow realtime event", {
          runId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    };

    const init = await step.run("initialize-workflow-run", async () => {
      const [runRow] = await db
        .select()
        .from(workflowRun)
        .where(eq(workflowRun.id, runId));
      if (!runRow) throw new Error(`Workflow run ${runId} not found`);

      const [wfRow] = await db
        .select()
        .from(workflow)
        .where(eq(workflow.id, runRow.workflowId));
      if (!wfRow) {
        throw new NonRetriableError(`Workflow ${runRow.workflowId} not found`);
      }

      const [nodeRows, edgeRows] = await Promise.all([
        db
          .select()
          .from(workflowNode)
          .where(eq(workflowNode.workflowId, wfRow.id)),
        db
          .select()
          .from(workflowEdge)
          .where(eq(workflowEdge.workflowId, wfRow.id)),
      ]);

      const nodes: WorkflowNode[] = nodeRows.map((n) => ({
        id: n.id,
        type: n.type,
        name: n.name,
        position: n.position,
        data: n.data,
      }));
      const edges: WorkflowEdge[] = edgeRows.map((e) => ({
        id: e.id,
        sourceNodeId: e.sourceNodeId,
        targetNodeId: e.targetNodeId,
        sourceHandle: e.sourceHandle,
        targetHandle: e.targetHandle,
      }));

      const sortedNodes = validateAndSortWorkflowGraph(nodes, edges);
      const loopBodyMap = extractLoopBodyMap(nodes, edges);
      const serializedLoopBodyMap: Record<string, string[]> = {};
      for (const [loopId, bodyIds] of loopBodyMap.entries()) {
        serializedLoopBodyMap[loopId] = Array.from(bodyIds);
      }

      const initialized = await db
        .update(workflowRun)
        .set({ status: "running", errorMessage: null, updatedAt: new Date() })
        .where(and(eq(workflowRun.id, runId), ne(workflowRun.status, "failed")))
        .returning({ id: workflowRun.id });

      if (initialized.length === 0) {
        return {
          cancelled: true as const,
          runRow,
          wfRow,
          sortedNodes,
          edges,
          serializedLoopBodyMap,
        };
      }

      await emit({ type: "workflow-start", runId });

      return {
        cancelled: false as const,
        runRow,
        wfRow,
        sortedNodes,
        edges,
        serializedLoopBodyMap,
      };
    });

    if (init.cancelled) {
      return { success: false, cancelled: true };
    }

    const { runRow, wfRow, sortedNodes, edges, serializedLoopBodyMap } = init;
    const loopBodyMap = new Map<string, Set<string>>(
      Object.entries(serializedLoopBodyMap).map(([k, v]) => [k, new Set(v)]),
    );
    const allLoopBodyNodeIds = new Set<string>();
    for (const bodySet of loopBodyMap.values()) {
      for (const id of bodySet) {
        allLoopBodyNodeIds.add(id);
      }
    }

    const nodeStates: Record<string, WorkflowNodeRunState> = {
      ...(runRow.nodeStates ?? {}),
    };
    const contextData: Record<string, unknown> = {
      ...(runRow.contextData ?? {}),
    };
    const activeHandlesByNode = new Map<string, Set<string>>();
    const skippedNodeIds = new Set<string>();
    let outputAttachmentIds: string[] = [...(runRow.outputAttachmentIds ?? [])];
    let activeWorkbookFilePath: string | null = null;
    let activeArtifact: ArtifactData | null = null;

    for (let idx = 0; idx < sortedNodes.length; idx++) {
      const node = sortedNodes[idx];
      if (allLoopBodyNodeIds.has(node.id)) {
        continue;
      }

      const eligibility = resolveNodeExecutionEligibility(
        node.id,
        edges,
        activeHandlesByNode,
        skippedNodeIds,
      );

      if (eligibility === "skip") {
        skippedNodeIds.add(node.id);
        const bodyIds = loopBodyMap.get(node.id);
        if (bodyIds) {
          for (const bodyId of bodyIds) {
            skippedNodeIds.add(bodyId);
            nodeStates[bodyId] = { status: "skipped" };
          }
        }
        await step.run(`skip-node-${node.id}`, async () => {
          nodeStates[node.id] = { status: "skipped" };
          await db
            .update(workflowRun)
            .set({ nodeStates, updatedAt: new Date() })
            .where(
              and(eq(workflowRun.id, runId), ne(workflowRun.status, "failed")),
            );
          await emit({ type: "workflow-node-skipped", runId, nodeId: node.id });
        });
        continue;
      }

      if (node.type === "loop" && node.data.kind === "loop") {
        const loopData = node.data;
        let items: unknown[];
        if (loopData.mode === "for_each") {
          const resolved = resolveWorkflowTemplateValue(
            loopData.itemsTemplate ?? "",
            { ...(runRow.initialData ?? {}), ...contextData },
          );
          if (!Array.isArray(resolved)) {
            await step.run(`fail-loop-${node.id}`, async () => {
              await failWorkflowRun(
                runId,
                node.id,
                `Loop node "${node.name}" expected an array from "${loopData.itemsTemplate ?? ""}"`,
                emit,
              );
            });
            return { success: false };
          }
          items = resolved;
        } else {
          const count = Math.max(0, Math.min(50, loopData.count ?? 0));
          items = Array.from({ length: count }, (_, i) => i);
        }

        const maxIter = Math.min(50, Math.max(1, loopData.maxIterations ?? 20));
        const truncated = items.length > maxIter;
        const slicedItems = items.slice(0, maxIter);

        const bodyNodeIds = loopBodyMap.get(node.id) ?? new Set<string>();
        const bodyNodes = sortedNodes.filter((n) => bodyNodeIds.has(n.id));
        const terminalBodyNodes = bodyNodes.filter(
          (bn) =>
            !edges.some(
              (e) =>
                e.sourceNodeId === bn.id && bodyNodeIds.has(e.targetNodeId),
            ),
        );

        const results: unknown[] = [];
        for (let i = 0; i < slicedItems.length; i++) {
          const item = slicedItems[i];
          const iterContextData: Record<string, unknown> = {
            ...contextData,
            [loopData.variableName]: {
              item,
              index: i,
              total: slicedItems.length,
              isFirst: i === 0,
              isLast: i === slicedItems.length - 1,
            },
            item,
            index: i,
          };
          const iterActiveHandles = new Map<string, Set<string>>([
            [node.id, new Set(["body"])],
          ]);
          const iterSkipped = new Set<string>();

          for (let bIdx = 0; bIdx < bodyNodes.length; bIdx++) {
            const bodyNode = bodyNodes[bIdx];
            const bodyEligibility = resolveNodeExecutionEligibility(
              bodyNode.id,
              edges,
              iterActiveHandles,
              iterSkipped,
            );
            if (bodyEligibility === "skip") {
              iterSkipped.add(bodyNode.id);
              continue;
            }

            const bodyOutcome = await executeNodeWithGates({
              step: step as Parameters<typeof executeNodeWithGates>[0]["step"],
              runId,
              userId,
              node: bodyNode,
              stepIndex: bIdx,
              allNodes: sortedNodes,
              workflowRow: wfRow,
              initialData: runRow.initialData ?? {},
              contextData: iterContextData,
              inputAttachmentIds: runRow.inputAttachmentIds ?? [],
              outputAttachmentIds,
              activeWorkbookFilePath,
              activeArtifact,
              dryRun: runRow.dryRun,
              nodeStates,
              emit,
              stepIdPrefix: `loop-${node.id}-iter-${i}-`,
            });

            if (bodyOutcome.status === "cancelled") {
              return { success: false, cancelled: true };
            }
            if (bodyOutcome.status !== "completed") {
              return { success: false };
            }

            iterActiveHandles.set(
              bodyNode.id,
              new Set(bodyOutcome.activeHandles),
            );
            iterContextData[bodyNode.data.variableName] =
              bodyOutcome.contextEntry;
            outputAttachmentIds = bodyOutcome.outputAttachmentIds;
            activeWorkbookFilePath = bodyOutcome.activeWorkbookFilePath;
            activeArtifact = bodyOutcome.activeArtifact ?? activeArtifact;
          }

          if (terminalBodyNodes.length === 0) {
            results.push(item);
          } else if (terminalBodyNodes.length === 1) {
            results.push(
              iterContextData[terminalBodyNodes[0].data.variableName],
            );
          } else {
            const combined: Record<string, unknown> = {};
            for (const tn of terminalBodyNodes) {
              combined[tn.data.variableName] =
                iterContextData[tn.data.variableName];
            }
            results.push(combined);
          }
        }

        if (slicedItems.length === 0) {
          for (const bodyNode of bodyNodes) {
            nodeStates[bodyNode.id] = { status: "skipped" };
          }
        }

        contextData[loopData.variableName] = {
          results,
          items: slicedItems,
          count: slicedItems.length,
        };
        activeHandlesByNode.set(node.id, new Set(["done"]));
        nodeStates[node.id] = {
          status: "completed",
          loopSummary: {
            totalItems: items.length,
            iterations: slicedItems.length,
            truncated,
          },
          completedAt: new Date().toISOString(),
        };

        await step.run(`checkpoint-node-${node.id}`, async () => {
          await db
            .update(workflowRun)
            .set({
              currentNodeId: node.id,
              nodeStates,
              contextData,
              outputAttachmentIds,
              updatedAt: new Date(),
            })
            .where(
              and(eq(workflowRun.id, runId), ne(workflowRun.status, "failed")),
            );
          if (slicedItems.length === 0) {
            for (const bodyNode of bodyNodes) {
              await emit({
                type: "workflow-node-skipped",
                runId,
                nodeId: bodyNode.id,
              });
            }
          }
          await emit({
            type: "workflow-node-complete",
            runId,
            nodeId: node.id,
            state: nodeStates[node.id],
            outputAttachmentIds,
          });
        });
        continue;
      }

      const outcome = await executeNodeWithGates({
        step: step as Parameters<typeof executeNodeWithGates>[0]["step"],
        runId,
        userId,
        node,
        stepIndex: idx,
        allNodes: sortedNodes,
        workflowRow: wfRow,
        initialData: runRow.initialData ?? {},
        contextData,
        inputAttachmentIds: runRow.inputAttachmentIds ?? [],
        outputAttachmentIds,
        activeWorkbookFilePath,
        activeArtifact,
        dryRun: runRow.dryRun,
        nodeStates,
        emit,
      });

      if (outcome.status === "cancelled") {
        return { success: false, cancelled: true };
      }
      if (outcome.status !== "completed") {
        return { success: false };
      }

      activeHandlesByNode.set(node.id, new Set(outcome.activeHandles));
      outputAttachmentIds = outcome.outputAttachmentIds;
      activeWorkbookFilePath = outcome.activeWorkbookFilePath;
      activeArtifact = outcome.activeArtifact ?? activeArtifact;
    }

    const completed = await step.run("finalize-workflow-run", async () => {
      const updated = await db
        .update(workflowRun)
        .set({
          status: "completed",
          currentNodeId: null,
          outputAttachmentIds,
          updatedAt: new Date(),
        })
        .where(and(eq(workflowRun.id, runId), ne(workflowRun.status, "failed")))
        .returning({ id: workflowRun.id });

      if (updated.length === 0) {
        return false;
      }

      await emit({
        type: "workflow-complete",
        runId,
        outputAttachmentIds,
      });
      return true;
    });

    if (!completed) {
      return { success: false, cancelled: true };
    }

    return { success: true, completed: true };
  },
);
