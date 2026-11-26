import { eq } from "drizzle-orm";
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
import {
  extractLoopBodyMap,
  resolveNodeExecutionEligibility,
  validateAndSortWorkflowGraph,
} from "@/lib/workflows/dag-planner";
import { executeLoopNode } from "@/lib/workflows/execute-loop-node";
import { updateActiveWorkflowRun } from "@/lib/workflows/workflow-run-db";
import { executeNodeWithGates } from "@/lib/workflows/workflow-run-gates";
import type { WorkflowStepTools } from "@/lib/workflows/workflow-run-helpers";
import type { ArtifactData } from "@/types/artifact/artifact-data";
import type {
  LoopNodeData,
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
      const updated = await updateActiveWorkflowRun(runId, {
        status: "failed",
        errorMessage: appErr.message,
      });

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
    const stepTools = step as unknown as WorkflowStepTools;
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

      const initialized = await updateActiveWorkflowRun(runId, {
        status: "running",
        errorMessage: null,
      });

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
          await updateActiveWorkflowRun(runId, { nodeStates });
          await emit({ type: "workflow-node-skipped", runId, nodeId: node.id });
        });
        continue;
      }

      if (node.type === "loop" && node.data.kind === "loop") {
        const loopOutcome = await executeLoopNode({
          step: stepTools,
          runId,
          userId,
          node: node as WorkflowNode & { data: LoopNodeData },
          sortedNodes,
          edges,
          loopBodyMap,
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

        if (loopOutcome.status === "cancelled") {
          return { success: false, cancelled: true };
        }
        if (loopOutcome.status !== "completed") {
          return { success: false };
        }

        activeHandlesByNode.set(node.id, new Set(["done"]));
        outputAttachmentIds = loopOutcome.outputAttachmentIds;
        activeWorkbookFilePath = loopOutcome.activeWorkbookFilePath;
        activeArtifact = loopOutcome.activeArtifact ?? activeArtifact;
        continue;
      }

      const outcome = await executeNodeWithGates({
        step: stepTools,
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
      const updated = await updateActiveWorkflowRun(runId, {
        status: "completed",
        currentNodeId: null,
        outputAttachmentIds,
      });

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
