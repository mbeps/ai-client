import { randomUUID } from "crypto";
import type { WorkflowStreamEvent } from "@/lib/inngest/workflow-run-channel";
import { updateActiveWorkflowRun } from "@/lib/workflows/workflow-run-db";
import {
  executeSingleWorkflowNode,
  failWorkflowRun,
  type NodeStepOutcome,
  type WorkflowRunExecutionRow,
  type WorkflowStepTools,
} from "@/lib/workflows/workflow-run-helpers";
import type { ResumedToolDecision } from "@/lib/workflows/workflow-tool-approval";
import type { ArtifactData } from "@/types/artifact/artifact-data";
import type { PendingApproval } from "@/types/tool/approval";
import type {
  WorkflowApprovalConfig,
  WorkflowNode,
  WorkflowNodeRunState,
} from "@/types/workflows/workflow";

/**
 * Resolves human review timing for a workflow node (`before`, `after`, or `none`).
 */
export function resolveNodeReviewGate(
  node: WorkflowNode,
  approvalConfig: WorkflowApprovalConfig,
): "before" | "after" | "none" {
  if (node.data.kind === "ai_step") {
    if (!node.data.requiresReview) return "none";
    if (node.data.reviewTiming) return node.data.reviewTiming;
    return approvalConfig.defaultReviewGate === "before" ? "before" : "after";
  }
  if (node.data.kind === "http_request" && node.data.requiresReview) {
    return "before";
  }
  return "none";
}

/**
 * Suspends a workflow run for human verification before or after executing a node.
 */
export async function awaitHumanReviewGate(params: {
  step: WorkflowStepTools;
  runId: string;
  nodeId: string;
  reviewPhase: "before" | "after";
  nodeStates: Record<string, WorkflowNodeRunState>;
  emit: (data: WorkflowStreamEvent) => Promise<void>;
  stepIdPrefix?: string;
}): Promise<boolean> {
  const {
    step,
    runId,
    nodeId,
    reviewPhase,
    nodeStates,
    emit,
    stepIdPrefix = "",
  } = params;

  const gateId = (await step.run(
    `${stepIdPrefix}pause-${reviewPhase}-review-${nodeId}`,
    async () => {
      const nextGateId = randomUUID();
      nodeStates[nodeId] = {
        ...nodeStates[nodeId],
        status: "awaiting_review",
        reviewPhase,
        gateId: nextGateId,
      };
      const paused = await updateActiveWorkflowRun(runId, {
        status: "awaiting_review",
        currentNodeId: nodeId,
        nodeStates,
      });
      if (paused.length === 0) return null;
      await emit({
        type: "workflow-review-required",
        runId,
        nodeId,
        reviewPhase,
      });
      return nextGateId;
    },
  )) as string | null;

  if (!gateId) {
    return false;
  }

  const evt = await step.waitForEvent(
    `${stepIdPrefix}wait-${reviewPhase}-review-${nodeId}`,
    {
      event: "workflows/run.approved",
      if: `async.data.runId == ${JSON.stringify(runId)} && async.data.nodeId == ${JSON.stringify(nodeId)} && async.data.gateId == ${JSON.stringify(gateId)}`,
      timeout: "7d",
    },
  );

  if (!evt) {
    await step.run(
      `${stepIdPrefix}timeout-${reviewPhase}-review-${nodeId}`,
      async () => {
        await failWorkflowRun(runId, nodeId, "Approval timed out", emit);
      },
    );
    return false;
  }

  if (
    evt.data?.nodeId !== nodeId ||
    evt.data?.gateId !== gateId ||
    evt.data?.approved !== true
  ) {
    const message =
      evt.data?.approved === false
        ? "Rejected by reviewer"
        : "Invalid approval event";
    await step.run(
      `${stepIdPrefix}reject-${reviewPhase}-review-${nodeId}`,
      async () => {
        await failWorkflowRun(runId, nodeId, message, emit);
      },
    );
    return false;
  }

  const resumed = await step.run(
    `${stepIdPrefix}resume-${reviewPhase}-review-${nodeId}`,
    async () => {
      const updated = await updateActiveWorkflowRun(runId, {
        status: "running",
      });
      return updated.length > 0;
    },
  );

  return Boolean(resumed);
}

function mapToolApprovalDecisions(
  pendingApprovals: PendingApproval[],
  evtData: {
    approved?: boolean;
    toolDecisions?: Array<{ approvalId: string; approved: boolean }>;
  },
): ResumedToolDecision[] | null {
  if (evtData.approved === false) {
    return pendingApprovals.map((approval) => ({
      approval,
      approved: false,
    }));
  }

  const decisionMap = new Map(
    (evtData.toolDecisions ?? []).map((d) => [d.approvalId, d.approved]),
  );
  for (const approval of pendingApprovals) {
    if (typeof decisionMap.get(approval.approvalId) !== "boolean") {
      return null;
    }
  }
  return pendingApprovals.map((approval) => ({
    approval,
    approved: decisionMap.get(approval.approvalId)!,
  }));
}

/**
 * Repeats durable wait-and-resume cycles whenever an AI step intercepts tool calls requiring approval.
 */
export async function resolvePendingToolApprovalLoop(params: {
  step: WorkflowStepTools;
  outcome: NodeStepOutcome;
  runId: string;
  userId: string;
  node: WorkflowNode;
  stepIndex: number;
  allNodes: WorkflowNode[];
  workflowRow: WorkflowRunExecutionRow;
  initialData: Record<string, unknown>;
  contextData: Record<string, unknown>;
  inputAttachmentIds: string[];
  outputAttachmentIds: string[];
  activeWorkbookFilePath: string | null;
  activeArtifact?: ArtifactData | null;
  dryRun: boolean;
  nodeStates: Record<string, WorkflowNodeRunState>;
  emit: (data: WorkflowStreamEvent) => Promise<void>;
  stepIdPrefix?: string;
}): Promise<NodeStepOutcome> {
  const {
    step,
    runId,
    userId,
    node,
    stepIndex,
    allNodes,
    workflowRow,
    initialData,
    contextData,
    inputAttachmentIds,
    outputAttachmentIds,
    activeWorkbookFilePath,
    activeArtifact,
    dryRun,
    nodeStates,
    emit,
    stepIdPrefix = "",
  } = params;

  let outcome = params.outcome;
  let approvalRound = 0;

  while (outcome.status === "awaiting_tool_approval") {
    const pendingApprovals = outcome.pendingApprovals;
    const gateId = (await step.run(
      `${stepIdPrefix}pause-tool-approval-${node.id}-${approvalRound}`,
      async () => {
        const nextGateId = randomUUID();
        nodeStates[node.id] = {
          ...nodeStates[node.id],
          status: "awaiting_tool_approval",
          pendingToolApprovals: pendingApprovals,
          gateId: nextGateId,
        };
        const paused = await updateActiveWorkflowRun(runId, {
          status: "awaiting_tool_approval",
          currentNodeId: node.id,
          nodeStates,
        });
        if (paused.length === 0) return null;
        await emit({
          type: "workflow-tool-approval-required",
          runId,
          nodeId: node.id,
          approvals: pendingApprovals,
        });
        return nextGateId;
      },
    )) as string | null;

    if (!gateId) {
      return { status: "cancelled" };
    }

    const evt = await step.waitForEvent(
      `${stepIdPrefix}wait-tool-approval-${node.id}-${approvalRound}`,
      {
        event: "workflows/run.approved",
        if: `async.data.runId == ${JSON.stringify(runId)} && async.data.nodeId == ${JSON.stringify(node.id)} && async.data.gateId == ${JSON.stringify(gateId)}`,
        timeout: "7d",
      },
    );

    if (!evt) {
      await step.run(
        `${stepIdPrefix}timeout-tool-approval-${node.id}-${approvalRound}`,
        async () => {
          await failWorkflowRun(runId, node.id, "Approval timed out", emit);
        },
      );
      return { status: "failed" };
    }

    const evtData = evt.data as
      | {
          nodeId?: string;
          gateId?: string;
          approved?: boolean;
          toolDecisions?: Array<{ approvalId: string; approved: boolean }>;
        }
      | undefined;

    const resumedDecisions =
      evtData &&
      evtData.nodeId === node.id &&
      evtData.gateId === gateId &&
      typeof evtData.approved === "boolean"
        ? mapToolApprovalDecisions(pendingApprovals, evtData)
        : null;

    if (!resumedDecisions) {
      await step.run(
        `${stepIdPrefix}invalid-tool-approval-${node.id}-${approvalRound}`,
        async () => {
          await failWorkflowRun(
            runId,
            node.id,
            "Invalid tool approval event",
            emit,
          );
        },
      );
      return { status: "failed" };
    }

    outcome = (await step.run(
      `${stepIdPrefix}resume-node-${node.id}-${approvalRound}`,
      async () => {
        const resumed = await updateActiveWorkflowRun(runId, {
          status: "running",
        });

        if (resumed.length === 0) {
          return { status: "cancelled" } satisfies NodeStepOutcome;
        }

        return executeSingleWorkflowNode({
          runId,
          userId,
          node,
          stepIndex,
          allNodes,
          workflowRow,
          initialData,
          contextData,
          inputAttachmentIds,
          outputAttachmentIds,
          activeWorkbookFilePath,
          activeArtifact,
          dryRun,
          emit,
          resumedToolDecisions: resumedDecisions,
        });
      },
    )) as NodeStepOutcome;
    approvalRound += 1;
  }

  return outcome;
}

/**
 * Executes a single node with its pre/post human review gates, tool approval loop,
 * state updates, and DB/realtime checkpointing. Shared by top-level DAG and loop body runs.
 */
export async function executeNodeWithGates(params: {
  step: WorkflowStepTools;
  runId: string;
  userId: string;
  node: WorkflowNode;
  stepIndex: number;
  allNodes: WorkflowNode[];
  workflowRow: WorkflowRunExecutionRow;
  initialData: Record<string, unknown>;
  contextData: Record<string, unknown>;
  inputAttachmentIds: string[];
  outputAttachmentIds: string[];
  activeWorkbookFilePath: string | null;
  activeArtifact: ArtifactData | null;
  dryRun: boolean;
  nodeStates: Record<string, WorkflowNodeRunState>;
  emit: (data: WorkflowStreamEvent) => Promise<void>;
  stepIdPrefix?: string;
}): Promise<
  | {
      status: "completed";
      activeHandles: string[];
      nodeState: WorkflowNodeRunState;
      contextEntry: unknown;
      outputAttachmentIds: string[];
      activeWorkbookFilePath: string | null;
      activeArtifact: ArtifactData | null;
    }
  | { status: "cancelled" }
  | { status: "failed" }
> {
  const {
    step,
    runId,
    userId,
    node,
    stepIndex,
    allNodes,
    workflowRow,
    initialData,
    contextData,
    inputAttachmentIds,
    outputAttachmentIds,
    activeWorkbookFilePath,
    activeArtifact,
    dryRun,
    nodeStates,
    emit,
    stepIdPrefix = "",
  } = params;

  const reviewGate = resolveNodeReviewGate(node, workflowRow.approvalConfig);
  if (reviewGate === "before") {
    const ok = await awaitHumanReviewGate({
      step,
      runId,
      nodeId: node.id,
      reviewPhase: "before",
      nodeStates,
      emit,
      stepIdPrefix,
    });
    if (!ok) return { status: "failed" };
  }

  const executeStepId = stepIdPrefix
    ? `${stepIdPrefix}node-${node.id}`
    : `execute-node-${node.id}`;
  const initialOutcome = (await step.run(executeStepId, async () =>
    executeSingleWorkflowNode({
      runId,
      userId,
      node,
      stepIndex,
      allNodes,
      workflowRow,
      initialData,
      contextData,
      inputAttachmentIds,
      outputAttachmentIds,
      activeWorkbookFilePath,
      activeArtifact,
      dryRun,
      emit,
    }),
  )) as NodeStepOutcome;

  const outcome = await resolvePendingToolApprovalLoop({
    step,
    outcome: initialOutcome,
    runId,
    userId,
    node,
    stepIndex,
    allNodes,
    workflowRow,
    initialData,
    contextData,
    inputAttachmentIds,
    outputAttachmentIds,
    activeWorkbookFilePath,
    activeArtifact,
    dryRun,
    nodeStates,
    emit,
    stepIdPrefix,
  });

  if (outcome.status === "cancelled") {
    return { status: "cancelled" };
  }
  if (outcome.status !== "completed") {
    return { status: "failed" };
  }

  nodeStates[node.id] = outcome.nodeState;
  contextData[node.data.variableName] = outcome.contextEntry;

  const checkpointStepId = `${stepIdPrefix}checkpoint-node-${node.id}`;
  await step.run(checkpointStepId, async () => {
    await updateActiveWorkflowRun(runId, {
      currentNodeId: node.id,
      nodeStates,
      contextData,
      outputAttachmentIds: outcome.outputAttachmentIds,
    });
    await emit({
      type: "workflow-node-complete",
      runId,
      nodeId: node.id,
      state: outcome.nodeState,
      outputAttachmentIds: outcome.outputAttachmentIds,
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
      stepIdPrefix,
    });
    if (!ok) return { status: "failed" };

    nodeStates[node.id] = outcome.nodeState;
    await step.run(
      `${stepIdPrefix}restore-after-review-${node.id}`,
      async () => {
        await updateActiveWorkflowRun(runId, { nodeStates });
        await emit({
          type: "workflow-node-complete",
          runId,
          nodeId: node.id,
          state: outcome.nodeState,
          outputAttachmentIds: outcome.outputAttachmentIds,
        });
      },
    );
  }

  return {
    status: "completed",
    activeHandles: outcome.activeHandles,
    nodeState: outcome.nodeState,
    contextEntry: outcome.contextEntry,
    outputAttachmentIds: outcome.outputAttachmentIds,
    activeWorkbookFilePath: outcome.activeWorkbookFilePath,
    activeArtifact: outcome.activeArtifact ?? activeArtifact,
  };
}
