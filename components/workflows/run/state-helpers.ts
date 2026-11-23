import type { WorkflowRunRow } from "@/drizzle/schemas/workflow-schema";
import type { ArtifactData } from "@/types/artifact/artifact-data";
import type { PendingApproval } from "@/types/tool/approval";
import type { ToolCallState } from "@/types/tool/tool-call";
import type {
  WorkflowNode,
  WorkflowNodeRunState,
  WorkflowRunItem,
  WorkflowRunStatus,
} from "@/types/workflows/workflow";

/**
 * Normalizes a database `workflow_run` row into a typed {@link WorkflowRunItem}.
 */
export function mapRunRowToWorkflowRun(row: WorkflowRunRow): WorkflowRunItem {
  return {
    id: row.id,
    workflowId: row.workflowId,
    userId: row.userId,
    triggerType: row.triggerType === "webhook" ? "webhook" : "manual",
    status: row.status as WorkflowRunStatus,
    currentNodeId: row.currentNodeId ?? null,
    dryRun: Boolean(row.dryRun),
    initialData: (row.initialData as Record<string, unknown>) ?? {},
    nodeStates: (row.nodeStates as Record<string, WorkflowNodeRunState>) ?? {},
    contextData: (row.contextData as Record<string, unknown>) ?? {},
    inputAttachmentIds: row.inputAttachmentIds ?? [],
    outputAttachmentIds: row.outputAttachmentIds ?? [],
    errorMessage: row.errorMessage ?? null,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

/** Marks a node as actively running cleanly while preserving prior tool traces. */
export function applyNodeStartEvent(
  prev: Record<string, WorkflowNodeRunState>,
  nodeId: string,
): Record<string, WorkflowNodeRunState> {
  return {
    ...prev,
    [nodeId]: {
      ...prev[nodeId],
      status: "running",
      startedAt: prev[nodeId]?.startedAt ?? new Date().toISOString(),
    },
  };
}

/** Marks an unvisited branch node as skipped. */
export function applyNodeSkippedEvent(
  prev: Record<string, WorkflowNodeRunState>,
  nodeId: string,
): Record<string, WorkflowNodeRunState> {
  return {
    ...prev,
    [nodeId]: {
      ...prev[nodeId],
      status: "skipped",
    },
  };
}

/** Appends or deduplicates an active tool call on a node trace. */
export function applyToolCallToNode(
  prev: Record<string, WorkflowNodeRunState>,
  nodeId: string,
  call: {
    toolCallId: string;
    toolName: string;
    args: unknown;
    serverName?: string;
  },
): Record<string, WorkflowNodeRunState> {
  const existing = prev[nodeId] ?? { status: "running" };
  const calls = existing.toolCalls ?? [];
  if (calls.some((c) => c.toolCallId === call.toolCallId)) {
    return prev;
  }
  const nextCall: ToolCallState = {
    toolCallId: call.toolCallId,
    toolName: call.toolName,
    args: call.args,
    serverName: call.serverName,
    status: "calling",
  };
  return {
    ...prev,
    [nodeId]: {
      ...existing,
      toolCalls: [...calls, nextCall],
    },
  };
}

/** Records a completed tool execution result onto a node trace. */
export function applyToolResultToNode(
  prev: Record<string, WorkflowNodeRunState>,
  nodeId: string,
  result: {
    toolCallId: string;
    toolName: string;
    result: unknown;
    serverName?: string;
  },
): Record<string, WorkflowNodeRunState> {
  const existing = prev[nodeId] ?? { status: "running" };
  const results = existing.toolResults ?? [];
  const nextCalls = (existing.toolCalls ?? []).map((call) =>
    call.toolCallId === result.toolCallId
      ? { ...call, status: "complete" as const, result: result.result }
      : call,
  );
  return {
    ...prev,
    [nodeId]: {
      ...existing,
      toolCalls: nextCalls,
      toolResults: [...results, result],
    },
  };
}

/** Transitions a node into `awaiting_review` before or after execution. */
export function applyReviewRequiredToNode(
  prev: Record<string, WorkflowNodeRunState>,
  nodeId: string,
  reviewPhase: "before" | "after",
): Record<string, WorkflowNodeRunState> {
  return {
    ...prev,
    [nodeId]: {
      ...prev[nodeId],
      status: "awaiting_review",
      reviewPhase,
    },
  };
}

/** Transitions a node into `awaiting_tool_approval` with pending tool descriptors. */
export function applyToolApprovalRequiredToNode(
  prev: Record<string, WorkflowNodeRunState>,
  nodeId: string,
  approvals: PendingApproval[],
): Record<string, WorkflowNodeRunState> {
  return {
    ...prev,
    [nodeId]: {
      ...prev[nodeId],
      status: "awaiting_tool_approval",
      pendingToolApprovals: approvals,
    },
  };
}

/** Merges a finalized node runtime payload upon completion or failure. */
export function applyNodeCompleteToNode(
  prev: Record<string, WorkflowNodeRunState>,
  nodeId: string,
  state: WorkflowNodeRunState,
): Record<string, WorkflowNodeRunState> {
  const existing = prev[nodeId];
  return {
    ...prev,
    [nodeId]: {
      ...existing,
      ...state,
      toolCalls: state.toolCalls ?? existing?.toolCalls,
      toolResults: state.toolResults ?? existing?.toolResults,
      pendingToolApprovals: undefined,
    },
  };
}

/** Computes completion percentage across workflow nodes. */
export function calculateWorkflowProgress(
  status: string,
  nodeStates: Record<string, WorkflowNodeRunState>,
  nodeCount: number,
): number {
  if (status === "completed") return 100;
  if (nodeCount <= 0) return 0;
  const finished = Object.values(nodeStates).filter(
    (state) => state.status === "completed" || state.status === "skipped",
  ).length;
  return Math.min(100, (finished / nodeCount) * 100);
}

/** Resolves an inline artifact for the currently selected node, or the latest shared artifact if enabled. */
export function resolveNodePreviewArtifact(
  selectedNodeId: string | null,
  nodes: WorkflowNode[],
  nodeStates: Record<string, WorkflowNodeRunState>,
  sharedCanvas = true,
): ArtifactData | null {
  const formatForNode = (
    nodeId: string,
    artifact: ArtifactData,
  ): ArtifactData => {
    const nodeName = nodes.find((n) => n.id === nodeId)?.name || "Step";
    return {
      ...artifact,
      title: artifact.title ? `${nodeName} - ${artifact.title}` : nodeName,
      messageId: `node-${nodeId}`,
    };
  };

  if (selectedNodeId) {
    const state = nodeStates[selectedNodeId];
    if (state?.artifact) {
      return formatForNode(selectedNodeId, state.artifact);
    }
  }

  if (sharedCanvas) {
    let latestNodeId: string | null = null;
    let latestCompletedAt = -Infinity;
    for (let i = nodes.length - 1; i >= 0; i--) {
      const node = nodes[i];
      const state = nodeStates[node.id];
      if (!state?.artifact) continue;
      const ts = state.completedAt ? Date.parse(state.completedAt) : NaN;
      if (!Number.isNaN(ts)) {
        if (ts > latestCompletedAt) {
          latestCompletedAt = ts;
          latestNodeId = node.id;
        }
      } else if (latestNodeId === null) {
        latestNodeId = node.id;
      }
    }
    if (latestNodeId && nodeStates[latestNodeId]?.artifact) {
      return formatForNode(latestNodeId, nodeStates[latestNodeId].artifact!);
    }
  }

  return null;
}

/** Resolves the attachment ID fallback to preview for a selected node or run inputs. */
export function resolveTargetAttachmentId(
  selectedNodeId: string | null,
  nodeStates: Record<string, WorkflowNodeRunState>,
  inputAttachmentIds?: string[],
): string | null {
  if (selectedNodeId) {
    const state = nodeStates[selectedNodeId];
    if (state?.outputAttachmentId) return state.outputAttachmentId;
  }
  if (inputAttachmentIds && inputAttachmentIds.length > 0) {
    return inputAttachmentIds[0];
  }
  return null;
}

/** Checks if any workflow node or input produced a previewable artifact. */
export function checkHasAnyArtifact(
  nodeStates: Record<string, WorkflowNodeRunState>,
  inputAttachmentIds?: string[],
): boolean {
  if ((inputAttachmentIds?.length ?? 0) > 0) return true;
  return Object.values(nodeStates).some(
    (s) => Boolean(s.artifact) || Boolean(s.outputAttachmentId),
  );
}
