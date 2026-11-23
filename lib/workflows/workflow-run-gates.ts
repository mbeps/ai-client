import { eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { workflowRun } from "@/drizzle/schemas/workflow-schema";
import type { WorkflowStreamEvent } from "@/lib/inngest/workflow-run-channel";
import {
  executeSingleWorkflowNode,
  failWorkflowRun,
  type NodeStepOutcome,
  type WorkflowRunExecutionRow,
} from "@/lib/workflows/workflow-run-helpers";
import type { ResumedToolDecision } from "@/lib/workflows/workflow-tool-approval";
import type { ArtifactData } from "@/types/artifact/artifact-data";
import type { PendingApproval } from "@/types/tool/approval";
import type {
  WorkflowNode,
  WorkflowNodeRunState,
} from "@/types/workflows/workflow";

/**
 * Suspends a workflow run for human verification before or after executing a node.
 */
export async function awaitHumanReviewGate(params: {
  step: any;
  runId: string;
  nodeId: string;
  reviewPhase: "before" | "after";
  nodeStates: Record<string, WorkflowNodeRunState>;
  emit: (data: WorkflowStreamEvent) => Promise<void>;
}): Promise<boolean> {
  const { step, runId, nodeId, reviewPhase, nodeStates, emit } = params;

  await step.run(`pause-${reviewPhase}-review-${nodeId}`, async () => {
    nodeStates[nodeId] = {
      ...nodeStates[nodeId],
      status: "awaiting_review",
      reviewPhase,
    };
    await db
      .update(workflowRun)
      .set({
        status: "awaiting_review",
        currentNodeId: nodeId,
        nodeStates,
        updatedAt: new Date(),
      })
      .where(eq(workflowRun.id, runId));
    await emit({
      type: "workflow-review-required",
      runId,
      nodeId,
      reviewPhase,
    });
  });

  const evt = await step.waitForEvent(`wait-${reviewPhase}-review-${nodeId}`, {
    event: "workflows/run.approved",
    match: "data.runId",
    timeout: "7d",
  });

  if (!evt) {
    await step.run(`timeout-${reviewPhase}-review-${nodeId}`, async () => {
      await failWorkflowRun(runId, nodeId, "Approval timed out", emit);
    });
    return false;
  }

  if (evt.data?.approved === false) {
    await step.run(`reject-${reviewPhase}-review-${nodeId}`, async () => {
      await failWorkflowRun(runId, nodeId, "Rejected by reviewer", emit);
    });
    return false;
  }

  await step.run(`resume-${reviewPhase}-review-${nodeId}`, async () => {
    await db
      .update(workflowRun)
      .set({ status: "running", updatedAt: new Date() })
      .where(eq(workflowRun.id, runId));
  });

  return true;
}

function mapToolApprovalDecisions(
  pendingApprovals: PendingApproval[],
  evtData: {
    approved?: boolean;
    toolDecisions?: Array<{ approvalId: string; approved: boolean }>;
  },
): ResumedToolDecision[] {
  const decisionMap = new Map(
    (evtData.toolDecisions ?? []).map((d) => [d.approvalId, d.approved]),
  );
  return pendingApprovals.map((approval) => ({
    approval,
    approved: decisionMap.get(approval.approvalId) ?? Boolean(evtData.approved),
  }));
}

/**
 * Repeats durable wait-and-resume cycles whenever an AI step intercepts tool calls requiring approval.
 */
export async function resolvePendingToolApprovalLoop(params: {
  step: any;
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
  } = params;

  let outcome = params.outcome;
  let approvalRound = 0;

  while (outcome.status === "awaiting_tool_approval") {
    const pendingApprovals = outcome.pendingApprovals;
    await step.run(
      `pause-tool-approval-${node.id}-${approvalRound}`,
      async () => {
        nodeStates[node.id] = {
          ...nodeStates[node.id],
          status: "awaiting_tool_approval",
          pendingToolApprovals: pendingApprovals,
        };
        await db
          .update(workflowRun)
          .set({
            status: "awaiting_tool_approval",
            currentNodeId: node.id,
            nodeStates,
            updatedAt: new Date(),
          })
          .where(eq(workflowRun.id, runId));
        await emit({
          type: "workflow-tool-approval-required",
          runId,
          nodeId: node.id,
          approvals: pendingApprovals,
        });
      },
    );

    const evt = await step.waitForEvent(
      `wait-tool-approval-${node.id}-${approvalRound}`,
      { event: "workflows/run.approved", match: "data.runId", timeout: "7d" },
    );

    if (!evt) {
      await step.run(
        `timeout-tool-approval-${node.id}-${approvalRound}`,
        async () => {
          await failWorkflowRun(runId, node.id, "Approval timed out", emit);
        },
      );
      return { status: "failed" };
    }

    const resumedDecisions = mapToolApprovalDecisions(
      pendingApprovals,
      (evt.data ?? {}) as {
        approved?: boolean;
        toolDecisions?: Array<{ approvalId: string; approved: boolean }>;
      },
    );

    outcome = (await step.run(
      `resume-node-${node.id}-${approvalRound}`,
      async () => {
        await db
          .update(workflowRun)
          .set({ status: "running", updatedAt: new Date() })
          .where(eq(workflowRun.id, runId));

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
