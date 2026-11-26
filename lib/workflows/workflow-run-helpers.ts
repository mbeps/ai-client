import { eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
  type WorkflowRow,
  workflowRun,
} from "@/drizzle/schemas/workflow-schema";
import { resolveLinkedSubagents } from "@/lib/agents/resolve-linked-subagents";
import { resolveProvider } from "@/lib/chat/resolve-provider";
import type { WorkflowStreamEvent } from "@/lib/inngest/workflow-run-channel";
import { buildFileContext } from "@/lib/workflows/build-file-context";
import { evaluateIfConditionNode } from "@/lib/workflows/evaluate-if-condition";
import { executeAiStepNode } from "@/lib/workflows/execute-ai-step-node";
import { executeFilterNode } from "@/lib/workflows/execute-filter-node";
import { executeHttpRequestNode } from "@/lib/workflows/execute-http-node";
import { loadWorkflowContext } from "@/lib/workflows/load-workflow-context";
import { resolveEffectiveAiStepConfig } from "@/lib/workflows/resolve-effective-ai-step-config";
import { updateActiveWorkflowRun } from "@/lib/workflows/workflow-run-db";
import type { ResumedToolDecision } from "@/lib/workflows/workflow-tool-approval";
import type { Agent } from "@/types/agent/agent";
import type { ArtifactData } from "@/types/artifact/artifact-data";
import type { PendingApproval } from "@/types/tool/approval";
import {
  type AiStepNodeData,
  RESERVED_STRUCTURED_OUTPUT_FIELDS,
  type WorkflowNode,
  type WorkflowNodeRunState,
} from "@/types/workflows/workflow";

/** Minimal durable Inngest `step` contract required by workflow execution helpers. */
export interface WorkflowStepTools {
  run: <T>(id: string, fn: () => Promise<T>) => Promise<T>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  waitForEvent: (id: string, opts: unknown) => Promise<any>;
}

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
 * Marks a workflow run as failed in PostgreSQL and emits an `error` realtime event.
 */
export async function failWorkflowRun(
  runId: string,
  nodeId: string | undefined,
  errorMessage: string,
  emit: (data: WorkflowStreamEvent) => Promise<void>,
): Promise<void> {
  const updated = await updateActiveWorkflowRun(runId, {
    status: "failed",
    currentNodeId: nodeId ?? null,
    errorMessage,
  });

  if (updated.length > 0) {
    await emit({ type: "error", nodeId, message: errorMessage });
  }
}

async function resolveNodeChatModel(params: {
  userId: string;
  nodeModelId?: string;
  nodeReasoningEffort?: WorkflowRow["reasoningEffort"];
  workflowRow: WorkflowRunExecutionRow;
  allNodes: WorkflowNode[];
}) {
  const { userId, nodeModelId, nodeReasoningEffort, workflowRow, allNodes } =
    params;
  const targetModelId = nodeModelId || workflowRow.modelId;
  const targetEffort =
    (nodeModelId ? nodeReasoningEffort : workflowRow.reasoningEffort) ??
    undefined;
  let resolved: Awaited<ReturnType<typeof resolveProvider>> | null;
  if (targetModelId) {
    resolved = await resolveProvider(userId, targetModelId, targetEffort).catch(
      () => null,
    );
  } else {
    const wfCtx = await loadWorkflowContext({
      userId,
      workflowRow,
      nodes: allNodes,
    });
    try {
      resolved = wfCtx.resolvedProvider;
    } finally {
      await wfCtx.mcpCleanup();
    }
  }
  if (resolved?.sdkProvider?.chat && resolved.modelId) {
    return resolved.sdkProvider.chat(resolved.modelId);
  }
  return undefined;
}

async function executeAiStepNodeWrapper(params: {
  runId: string;
  userId: string;
  node: WorkflowNode & { data: AiStepNodeData };
  stepIndex: number;
  allNodes: WorkflowNode[];
  workflowRow: WorkflowRunExecutionRow;
  contextData: Record<string, unknown>;
  inputAttachmentIds: string[];
  outputAttachmentIds: string[];
  activeWorkbookFilePath: string | null;
  activeArtifact?: ArtifactData | null;
  dryRun: boolean;
  emit: (data: WorkflowStreamEvent) => Promise<void>;
  resumedToolDecisions?: ResumedToolDecision[];
  startedAt: string;
}): Promise<NodeStepOutcome> {
  const {
    runId,
    userId,
    node,
    stepIndex,
    allNodes,
    workflowRow,
    contextData,
    inputAttachmentIds,
    outputAttachmentIds,
    activeWorkbookFilePath,
    activeArtifact,
    dryRun,
    emit,
    resumedToolDecisions,
    startedAt,
  } = params;

  let linkedAgent: Agent | null = null;
  if (node.data.agentId) {
    const [resolvedAgent] = await resolveLinkedSubagents(userId, [
      node.data.agentId,
    ]);
    if (!resolvedAgent) {
      await failWorkflowRun(
        runId,
        node.id,
        `Linked agent "${node.data.agentId}" was not found or is no longer accessible.`,
        emit,
      );
      return { status: "failed" };
    }
    linkedAgent = resolvedAgent;
  }

  const effective = resolveEffectiveAiStepConfig({
    nodeData: node.data,
    linkedAgent,
    workflowRow,
  });

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
    modelOverride: effective.modelId,
    nodeOverride: {
      reasoningEffort: effective.reasoningEffort,
      knowledgeBaseIds: effective.knowledgeBaseIds,
      skillMode: effective.skillMode,
      skillIds: effective.skillIds,
      subagentIds: effective.subagentIds,
    },
  });

  try {
    const aiRes = await executeAiStepNode({
      runId,
      nodeId: node.id,
      nodeName: node.name,
      stepIndex,
      userId,
      data: {
        ...node.data,
        mcpServerIds: effective.mcpServerIds,
        subagentIds: effective.subagentIds,
      },
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
      agentPersonaPrompt: effective.agentPersonaPrompt,
      effectiveTools: effective.toolIds,
    });

    if (aiRes.status === "awaiting_tool_approval") {
      return {
        status: "awaiting_tool_approval",
        pendingApprovals: aiRes.pendingApprovals,
      };
    }
    if (aiRes.status === "failed") return { status: "failed" };

    const structuredFields = aiRes.structuredOutput
      ? Object.fromEntries(
          Object.entries(aiRes.structuredOutput).filter(
            ([k]) => !RESERVED_STRUCTURED_OUTPUT_FIELDS.has(k),
          ),
        )
      : {};

    return {
      status: "completed",
      activeHandles: ["main"],
      contextEntry: {
        ...structuredFields,
        text: aiRes.summary,
        ...(aiRes.structuredOutput ? { data: aiRes.structuredOutput } : {}),
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
        ...(aiRes.structuredOutput
          ? { structuredOutput: aiRes.structuredOutput }
          : {}),
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

/**
 * Executes a single DAG node (trigger, AI step, If condition, Filter, or HTTP request).
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
    const model =
      node.data.evaluationMode !== "deterministic"
        ? await resolveNodeChatModel({
            userId,
            nodeModelId: node.data.modelId,
            nodeReasoningEffort: node.data.reasoningEffort,
            workflowRow,
            allNodes,
          })
        : undefined;
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

  if (node.data.kind === "filter") {
    const model =
      node.data.evaluationMode === "llm"
        ? await resolveNodeChatModel({
            userId,
            nodeModelId: node.data.modelId,
            nodeReasoningEffort: node.data.reasoningEffort,
            workflowRow,
            allNodes,
          })
        : undefined;
    const filterRes = await executeFilterNode({
      data: node.data,
      context: contextData,
      model,
    });
    return {
      status: "completed",
      activeHandles: filterRes.activeHandles,
      contextEntry: {
        items: filterRes.items,
        excluded: filterRes.excluded,
        count: filterRes.count,
        totalCount: filterRes.totalCount,
        reasoning: filterRes.reasoning,
      },
      outputAttachmentIds,
      activeWorkbookFilePath,
      activeArtifact,
      nodeState: {
        status: "completed",
        summary: filterRes.reasoning,
        filterSummary: {
          kept: filterRes.count,
          total: filterRes.totalCount,
          reasoning: filterRes.reasoning,
        },
        startedAt,
        completedAt: new Date().toISOString(),
      },
    };
  }

  if (node.data.kind === "ai_step") {
    return executeAiStepNodeWrapper({
      runId,
      userId,
      node: node as WorkflowNode & { data: AiStepNodeData },
      stepIndex,
      allNodes,
      workflowRow,
      contextData,
      inputAttachmentIds,
      outputAttachmentIds,
      activeWorkbookFilePath,
      activeArtifact,
      dryRun,
      emit,
      resumedToolDecisions,
      startedAt,
    });
  }

  await failWorkflowRun(
    runId,
    node.id,
    `Unsupported node kind "${node.data.kind}" in single-node executor.`,
    emit,
  );
  return { status: "failed" };
}
