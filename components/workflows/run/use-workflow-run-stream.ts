"use client";

import { useRealtime } from "inngest/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getWorkflowRunRealtimeToken } from "@/actions/workflow-runs/get-workflow-run-realtime-token";
import { startWorkflowRunAction } from "@/actions/workflow-runs/start-workflow-run";
import {
  applyNodeCompleteToNode,
  applyNodeSkippedEvent,
  applyNodeStartEvent,
  applyReviewRequiredToNode,
  applyToolApprovalRequiredToNode,
  applyToolCallToNode,
  applyToolResultToNode,
} from "@/components/workflows/run/state-helpers";
import { useApiError } from "@/hooks/use-api-error";
import { getRealtimeApiBaseUrl } from "@/lib/inngest/realtime-url";
import {
  type WorkflowStreamEvent,
  workflowRunChannel,
} from "@/lib/inngest/workflow-run-channel";
import type {
  WorkflowNodeRunState,
  WorkflowRunItem,
  WorkflowWithGraph,
} from "@/types/workflows/workflow";

/** Params for {@link useWorkflowRunStream}. */
export interface UseWorkflowRunStreamParams {
  runId: string;
  run: WorkflowRunItem | null;
  workflow: WorkflowWithGraph | null;
  setRun: React.Dispatch<React.SetStateAction<WorkflowRunItem | null>>;
  setNodeStates: React.Dispatch<
    React.SetStateAction<Record<string, WorkflowNodeRunState>>
  >;
  setSelectedNodeId: (nodeId: string | null) => void;
  loadAttachmentUrls: (ids: string[]) => Promise<void>;
}

function reduceWorkflowStreamEvent(
  event: WorkflowStreamEvent,
  activeNodeRef: React.MutableRefObject<string | null>,
  setRun: React.Dispatch<React.SetStateAction<WorkflowRunItem | null>>,
  setNodeStates: React.Dispatch<
    React.SetStateAction<Record<string, WorkflowNodeRunState>>
  >,
  setSelectedNodeId: (nodeId: string | null) => void,
  loadAttachmentUrls: (ids: string[]) => Promise<void>,
  setStreamError: (msg: string | null) => void,
  handleApiError: (err: unknown) => boolean,
) {
  switch (event.type) {
    case "workflow-start":
      setRun((prev) => (prev ? { ...prev, status: "running" } : prev));
      break;
    case "workflow-node-start":
      activeNodeRef.current = event.nodeId;
      setNodeStates((prev) => applyNodeStartEvent(prev, event.nodeId));
      setRun((prev) =>
        prev
          ? { ...prev, status: "running", currentNodeId: event.nodeId }
          : prev,
      );
      setSelectedNodeId(event.nodeId);
      break;
    case "workflow-node-skipped":
      setNodeStates((prev) => applyNodeSkippedEvent(prev, event.nodeId));
      break;
    case "tool-call": {
      const targetId = event.nodeId ?? activeNodeRef.current;
      if (targetId) {
        setNodeStates((prev) => applyToolCallToNode(prev, targetId, event));
      }
      break;
    }
    case "tool-result": {
      const targetId = event.nodeId ?? activeNodeRef.current;
      if (targetId) {
        setNodeStates((prev) => applyToolResultToNode(prev, targetId, event));
      }
      break;
    }
    case "workflow-review-required":
      setNodeStates((prev) =>
        applyReviewRequiredToNode(prev, event.nodeId, event.reviewPhase),
      );
      setRun((prev) =>
        prev
          ? {
              ...prev,
              status: "awaiting_review",
              currentNodeId: event.nodeId,
            }
          : prev,
      );
      setSelectedNodeId(event.nodeId);
      break;
    case "workflow-tool-approval-required":
      setNodeStates((prev) =>
        applyToolApprovalRequiredToNode(prev, event.nodeId, event.approvals),
      );
      setRun((prev) =>
        prev
          ? {
              ...prev,
              status: "awaiting_tool_approval",
              currentNodeId: event.nodeId,
            }
          : prev,
      );
      setSelectedNodeId(event.nodeId);
      break;
    case "workflow-node-complete":
      setNodeStates((prev) =>
        applyNodeCompleteToNode(prev, event.nodeId, event.state),
      );
      if (event.outputAttachmentIds?.length) {
        void loadAttachmentUrls(event.outputAttachmentIds);
      }
      break;
    case "workflow-complete":
      setRun((prev) =>
        prev
          ? {
              ...prev,
              status: "completed",
              currentNodeId: null,
              outputAttachmentIds: event.outputAttachmentIds,
            }
          : prev,
      );
      void loadAttachmentUrls(event.outputAttachmentIds);
      toast.success("Workflow run completed");
      break;
    case "error": {
      const targetId = event.nodeId ?? activeNodeRef.current;
      if (targetId) {
        setNodeStates((prev) =>
          applyNodeCompleteToNode(prev, targetId, {
            ...prev[targetId],
            status: "failed",
            errorMessage: event.message,
          }),
        );
      }
      setStreamError(event.message);
      setRun((prev) =>
        prev
          ? { ...prev, status: "failed", errorMessage: event.message }
          : prev,
      );
      handleApiError(new Error(event.message));
      break;
    }
  }
}

/**
 * Auto-starts pending runs and subscribes to Inngest Realtime `workflow:${runId}` progress events.
 */
export function useWorkflowRunStream({
  runId,
  run,
  workflow,
  setRun,
  setNodeStates,
  setSelectedNodeId,
  loadAttachmentUrls,
}: UseWorkflowRunStreamParams) {
  const { handleApiError } = useApiError();
  const [streamError, setStreamError] = useState<string | null>(null);
  const activeNodeRef = useRef<string | null>(null);
  const lastProcessedIndexRef = useRef(0);
  const hasStartedRef = useRef(false);

  const isExecutionActive =
    run?.status === "pending" ||
    run?.status === "running" ||
    run?.status === "awaiting_review" ||
    run?.status === "awaiting_tool_approval";

  useEffect(() => {
    lastProcessedIndexRef.current = 0;
    hasStartedRef.current = false;
  }, []);

  useEffect(() => {
    if (
      !run ||
      !workflow ||
      run.status !== "pending" ||
      hasStartedRef.current
    ) {
      return;
    }
    hasStartedRef.current = true;
    void startWorkflowRunAction(run.id).then((res) => {
      if (!res.ok) {
        setStreamError(res.error.message || "Failed to start workflow run");
      }
    });
  }, [run, workflow]);

  const fetchToken = useCallback(async () => {
    if (!runId) throw new Error("No runId");
    const res = await getWorkflowRunRealtimeToken(runId);
    if (!res.ok) throw new Error(res.error.message);
    return res.value;
  }, [runId]);

  const apiBaseUrl = useMemo(() => getRealtimeApiBaseUrl(), []);

  const { messages } = useRealtime({
    channel: runId ? workflowRunChannel({ runId }) : undefined,
    topics: ["progress"] as const,
    token: fetchToken,
    enabled: Boolean(runId && isExecutionActive),
    historyLimit: null,
    apiBaseUrl,
  });

  useEffect(() => {
    const start =
      messages.all.length < lastProcessedIndexRef.current
        ? 0
        : lastProcessedIndexRef.current;
    for (let i = start; i < messages.all.length; i++) {
      const msg = messages.all[i];
      if (msg?.data) {
        reduceWorkflowStreamEvent(
          msg.data as WorkflowStreamEvent,
          activeNodeRef,
          setRun,
          setNodeStates,
          setSelectedNodeId,
          loadAttachmentUrls,
          setStreamError,
          handleApiError,
        );
      }
    }
    lastProcessedIndexRef.current = messages.all.length;
  }, [
    messages.all,
    setRun,
    setNodeStates,
    setSelectedNodeId,
    loadAttachmentUrls,
    handleApiError,
  ]);

  return { streamError };
}
