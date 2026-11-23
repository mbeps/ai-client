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
import {
  resolveNodeExecutionEligibility,
  validateAndSortWorkflowGraph,
} from "@/lib/workflows/dag-planner";
import {
  awaitHumanReviewGate,
  resolvePendingToolApprovalLoop,
} from "@/lib/workflows/workflow-run-gates";
import {
  executeSingleWorkflowNode,
  type NodeStepOutcome,
  resolveNodeReviewGate,
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

      const initialized = await db
        .update(workflowRun)
        .set({ status: "running", errorMessage: null, updatedAt: new Date() })
        .where(and(eq(workflowRun.id, runId), ne(workflowRun.status, "failed")))
        .returning({ id: workflowRun.id });

      if (initialized.length === 0) {
        return { cancelled: true as const, runRow, wfRow, sortedNodes, edges };
      }

      await emit({ type: "workflow-start", runId });

      return { cancelled: false as const, runRow, wfRow, sortedNodes, edges };
    });

    if (init.cancelled) {
      return { success: false, cancelled: true };
    }

    const { runRow, wfRow, sortedNodes, edges } = init;
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
      const eligibility = resolveNodeExecutionEligibility(
        node.id,
        edges,
        activeHandlesByNode,
        skippedNodeIds,
      );

      if (eligibility === "skip") {
        skippedNodeIds.add(node.id);
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

      const reviewGate = resolveNodeReviewGate(node, wfRow.approvalConfig);
      if (reviewGate === "before") {
        const ok = await awaitHumanReviewGate({
          step,
          runId,
          nodeId: node.id,
          reviewPhase: "before",
          nodeStates,
          emit,
        });
        if (!ok) return { success: false };
      }

      const initialOutcome = (await step.run(
        `execute-node-${node.id}`,
        async () =>
          executeSingleWorkflowNode({
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
            emit,
          }),
      )) as NodeStepOutcome;

      const outcome = await resolvePendingToolApprovalLoop({
        step,
        outcome: initialOutcome,
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
      nodeStates[node.id] = outcome.nodeState;
      contextData[node.data.variableName] = outcome.contextEntry;
      outputAttachmentIds = outcome.outputAttachmentIds;
      activeWorkbookFilePath = outcome.activeWorkbookFilePath;
      activeArtifact = outcome.activeArtifact ?? activeArtifact;

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
        await emit({
          type: "workflow-node-complete",
          runId,
          nodeId: node.id,
          state: outcome.nodeState,
          outputAttachmentIds,
        });
      });

      if (reviewGate === "after") {
        const ok = await awaitHumanReviewGate({
          step,
          runId,
          nodeId: node.id,
          reviewPhase: "after",
          nodeStates,
          emit,
        });
        if (!ok) return { success: false };
      }
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
