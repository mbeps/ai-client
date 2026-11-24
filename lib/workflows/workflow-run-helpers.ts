import { and, eq, ne } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
  type WorkflowRow,
  workflowRun,
} from "@/drizzle/schemas/workflow-schema";
import { resolveProvider } from "@/lib/chat/resolve-provider";
import type { WorkflowStreamEvent } from "@/lib/inngest/workflow-run-channel";
import { buildFileContext } from "@/lib/workflows/build-file-context";
import { evaluateIfConditionNode } from "@/lib/workflows/evaluate-if-condition";
import { executeAiStepNode } from "@/lib/workflows/execute-ai-step-node";
import { executeHttpRequestNode } from "@/lib/workflows/execute-http-node";
import { loadWorkflowContext } from "@/lib/workflows/load-workflow-context";
import type { ResumedToolDecision } from "@/lib/workflows/workflow-tool-approval";
import type { ArtifactData } from "@/types/artifact/artifact-data";
import type { PendingApproval } from "@/types/tool/approval";
import type {
  WorkflowApprovalConfig,
  WorkflowNode,
  WorkflowNodeRunState,
} from "@/types/workflows/workflow";

/** Projection of persisted workflow settings needed by node executors. */
export type WorkflowRunExecutionRow = Omit<
  WorkflowRow,
  "userId" | "webhookSecret" | "createdAt" | "updatedAt"
>;

/** Outcome of executing a single node inside a durable Inngest `step.run`. */
export type NodeStepOutcome =
  | {
      status: "completed";
      activeHandles: string[];
      nodeState: WorkflowNodeRunState;
      contextEntry: unknown;
      outputAttachmentIds: string[];
      activeWorkbookFilePath: string | null;
      activeArtifact?: ArtifactData | null;
    }
  | {
      status: "awaiting_tool_approval";
      pendingApprovals: PendingApproval[];
    }
  | { status: "cancelled" }
  | { status: "failed" };

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
 * Marks a workflow run as failed in PostgreSQL and emits an `error` realtime event.
 */
export async function failWorkflowRun(
  runId: string,
  nodeId: string | undefined,
  errorMessage: string,
  emit: (data: WorkflowStreamEvent) => Promise<void>,
): Promise<void> {
  const updated = await db
    .update(workflowRun)
    .set({
      status: "failed",
      currentNodeId: nodeId ?? null,
      errorMessage,
      updatedAt: new Date(),
    })
    .where(and(eq(workflowRun.id, runId), ne(workflowRun.status, "failed")))
    .returning({ id: workflowRun.id });

  if (updated.length > 0) {
    await emit({ type: "error", nodeId, message: errorMessage });
  }
}

/**
 * Executes a single DAG node (trigger, AI step, If condition, or HTTP request).
 */
export async function executeSingleWorkflowNode(params: {
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
  emit: (data: WorkflowStreamEvent) => Promise<void>;
  resumedToolDecisions?: ResumedToolDecision[];
}): Promise<NodeStepOutcome> {
  const {
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
    resumedToolDecisions,
  } = params;

  const [currentRun] = await db
    .select({ id: workflowRun.id, status: workflowRun.status })
    .from(workflowRun)
    .where(eq(workflowRun.id, runId));

  if (!currentRun || currentRun.status === "failed") {
    return { status: "cancelled" };
  }

  const startedAt = new Date().toISOString();
  await emit({
    type: "workflow-node-start",
    runId,
    nodeId: node.id,
    nodeName: node.name,
    nodeType: node.type,
  });

  if (
    node.data.kind === "manual_trigger" ||
    node.data.kind === "webhook_trigger"
  ) {
    const seed =
      initialData[node.data.variableName] ??
      (node.data.kind === "webhook_trigger"
        ? (initialData.webhook ?? initialData)
        : initialData);
    return {
      status: "completed",
      activeHandles: ["main"],
      contextEntry: seed,
      outputAttachmentIds,
      activeWorkbookFilePath,
      activeArtifact,
      nodeState: {
        status: "completed",
        summary: `Triggered (${node.type})`,
        startedAt,
        completedAt: new Date().toISOString(),
      },
    };
  }

  if (node.data.kind === "http_request") {
    const httpRes = await executeHttpRequestNode({
      runId,
      nodeId: node.id,
      data: node.data,
      context: contextData,
      dryRun,
    });
    const httpResponse = {
      status: httpRes.status,
      statusText: httpRes.statusText,
      data: httpRes.data,
    };
    return {
      status: "completed",
      activeHandles: ["main"],
      contextEntry: httpResponse,
      outputAttachmentIds,
      activeWorkbookFilePath,
      activeArtifact,
      nodeState: {
        status: "completed",
        summary: httpRes.summary,
        httpResponse,
        startedAt,
        completedAt: new Date().toISOString(),
      },
    };
  }

  if (node.data.kind === "if_condition") {
    let model: any;
    if (node.data.evaluationMode !== "deterministic") {
      const targetModelId = node.data.modelId || workflowRow.modelId;
      const targetEffort =
        (node.data.modelId
          ? node.data.reasoningEffort
          : workflowRow.reasoningEffort) ?? undefined;
      const resolved = targetModelId
        ? await resolveProvider(userId, targetModelId, targetEffort).catch(
            () => null,
          )
        : (await loadWorkflowContext({ userId, workflowRow, nodes: allNodes }))
            .resolvedProvider;
      if (resolved?.sdkProvider?.chat && resolved.modelId) {
        model = resolved.sdkProvider.chat(resolved.modelId);
      }
    }
    const condRes = await evaluateIfConditionNode({
      data: node.data,
      context: contextData,
      model,
    });
    return {
      status: "completed",
      activeHandles: [condRes.branch],
      contextEntry: {
        branch: condRes.branch,
        result: condRes.branch === "true",
        reasoning: condRes.reasoning,
      },
      outputAttachmentIds,
      activeWorkbookFilePath,
      activeArtifact,
      nodeState: {
        status: "completed",
        summary: condRes.reasoning,
        branchTaken: condRes.branch,
        conditionReasoning: condRes.reasoning,
        startedAt,
        completedAt: new Date().toISOString(),
      },
    };
  }

  const stageIds =
    outputAttachmentIds.length > 0
      ? [outputAttachmentIds[outputAttachmentIds.length - 1]]
      : inputAttachmentIds;
  const { attachmentRows } = workflowRow.requiresFileUpload
    ? await buildFileContext(stageIds, userId)
    : { attachmentRows: [] };

  const wfCtx = await loadWorkflowContext({
    userId,
    workflowRow,
    nodes: allNodes,
    modelOverride: node.data.modelId ?? null,
    nodeOverride: {
      reasoningEffort: node.data.reasoningEffort,
      knowledgeBaseIds: node.data.knowledgeBaseIds,
      skillMode: node.data.skillMode,
      skillIds: node.data.skillIds,
      subagentIds: node.data.subagentIds,
    },
  });

  try {
    const aiRes = await executeAiStepNode({
      runId,
      nodeId: node.id,
      nodeName: node.name,
      stepIndex,
      userId,
      data: node.data,
      workflow: workflowRow,
      context: contextData,
      resolvedProvider: wfCtx.resolvedProvider!,
      allServers: wfCtx.allServers,
      runMcpTools: wfCtx.mcpTools,
      runToolSourceMap: wfCtx.toolSourceMap,
      kbContext: wfCtx.kbContext,
      skillCatalog: wfCtx.availableSkills,
      preloadedSkills: wfCtx.selectedSkills,
      linkedSubagents: wfCtx.linkedSubagents,
      currentAttachmentRows: attachmentRows,
      currentOutputAttachmentIds: outputAttachmentIds,
      activeWorkbookFilePath,
      activeArtifact,
      dryRun,
      emit,
      resumedToolDecisions,
    });

    if (aiRes.status === "awaiting_tool_approval") {
      return {
        status: "awaiting_tool_approval",
        pendingApprovals: aiRes.pendingApprovals,
      };
    }
    if (aiRes.status === "failed") return { status: "failed" };

    return {
      status: "completed",
      activeHandles: ["main"],
      contextEntry: {
        text: aiRes.summary,
        artifact: aiRes.artifact,
        outputAttachmentId: aiRes.outputAttachmentId,
      },
      outputAttachmentIds: aiRes.currentOutputAttachmentIds,
      activeWorkbookFilePath: aiRes.activeWorkbookFilePath,
      activeArtifact:
        workflowRow.canvasConfig?.sharedCanvas !== false
          ? (aiRes.artifact ?? activeArtifact ?? null)
          : null,
      nodeState: {
        status: "completed",
        summary: aiRes.summary,
        artifact: aiRes.artifact,
        outputAttachmentId: aiRes.outputAttachmentId,
        toolCalls: aiRes.toolCalls,
        startedAt,
        completedAt: new Date().toISOString(),
      },
    };
  } finally {
    await wfCtx.mcpCleanup();
  }
}
