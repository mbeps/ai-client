"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { getAttachmentUrl } from "@/actions/attachments/get-attachment-url";
import { approveWorkflowRunAction } from "@/actions/workflow-runs/approve-workflow-run";
import { getWorkflowRun } from "@/actions/workflow-runs/get-workflow-run";
import { getWorkflow } from "@/actions/workflows/get-workflow";
import { mapRunRowToWorkflowRun } from "@/components/workflows/run/state-helpers";
import { ERROR_CODE } from "@/lib/error/error-code";
import type {
  WorkflowNodeRunState,
  WorkflowRunItem,
  WorkflowWithGraph,
} from "@/types/workflows/workflow";

/**
 * Loads workflow run metadata, graph definition, and handles approval submissions.
 */
export function useWorkflowRunData(runId: string) {
  const [run, setRun] = useState<WorkflowRunItem | null>(null);
  const [workflow, setWorkflow] = useState<WorkflowWithGraph | null>(null);
  const [nodeStates, setNodeStates] = useState<
    Record<string, WorkflowNodeRunState>
  >({});
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isArtifactOpen, setIsArtifactOpen] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isApproving, setIsApproving] = useState(false);
  const [attachmentMeta, setAttachmentMeta] = useState<
    Record<string, { url: string; name: string }>
  >({});
  const mountedRef = useRef(true);

  const loadAttachmentUrls = useCallback(async (ids: string[]) => {
    if (ids.length === 0) return;
    const results = await Promise.allSettled(
      ids.map((id) => getAttachmentUrl(id)),
    );
    const meta: Record<string, { url: string; name: string }> = {};
    results.forEach((res, idx) => {
      if (res.status === "fulfilled" && res.value.ok) {
        meta[ids[idx]] = {
          url: res.value.value.url,
          name: res.value.value.name,
        };
      }
    });
    setAttachmentMeta((prev) => ({ ...prev, ...meta }));
  }, []);

  const loadRunData = useCallback(async () => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const runRes = await getWorkflowRun(runId);
      if (!mountedRef.current) return;
      if (!runRes.ok || !runRes.value) {
        if (!runRes.ok && runRes.error.code !== ERROR_CODE.NOT_FOUND) {
          setLoadError(runRes.error.message || "Failed to load workflow run");
        }
        return;
      }

      const mapped = mapRunRowToWorkflowRun(runRes.value);
      const wfRes = await getWorkflow(mapped.workflowId);
      if (!mountedRef.current) return;

      if (!wfRes.ok && wfRes.error.code !== ERROR_CODE.NOT_FOUND) {
        setLoadError(wfRes.error.message || "Failed to load workflow");
        return;
      }

      const loadedWorkflow = wfRes.ok && wfRes.value ? wfRes.value : null;
      setRun(mapped);
      setWorkflow(loadedWorkflow);
      setNodeStates(mapped.nodeStates);
      const lastArtifactNode =
        mapped.status === "completed" && loadedWorkflow
          ? [...loadedWorkflow.nodes]
              .reverse()
              .find((n) => Boolean(mapped.nodeStates[n.id]?.artifact))
          : undefined;
      setSelectedNodeId(
        mapped.currentNodeId ??
          lastArtifactNode?.id ??
          loadedWorkflow?.nodes[0]?.id ??
          null,
      );

      const attachmentIds = [
        ...mapped.inputAttachmentIds,
        ...mapped.outputAttachmentIds,
      ];
      void loadAttachmentUrls(attachmentIds);
    } catch (err) {
      if (mountedRef.current) {
        setLoadError(
          err instanceof Error ? err.message : "Failed to load workflow run",
        );
      }
    } finally {
      if (mountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [runId, loadAttachmentUrls]);

  useEffect(() => {
    mountedRef.current = true;
    void loadRunData();
    return () => {
      mountedRef.current = false;
    };
  }, [loadRunData]);

  const submitApproval = async (
    approved: boolean,
    options?: { feedback?: string; toolDecisions?: Record<string, boolean> },
  ) => {
    if (!run?.currentNodeId) return;
    const submittedNodeId = run.currentNodeId;
    setIsApproving(true);
    try {
      const formattedDecisions = options?.toolDecisions
        ? Object.entries(options.toolDecisions).map(
            ([approvalId, decision]) => ({
              approvalId,
              approved: decision,
            }),
          )
        : undefined;
      const res = await approveWorkflowRunAction({
        runId: run.id,
        nodeId: submittedNodeId,
        approved,
        feedback: options?.feedback || undefined,
        toolDecisions: formattedDecisions,
      });
      if (!res.ok) {
        toast.error(res.error.message || "Failed to submit approval");
        return;
      }
      setRun((prev) => {
        if (!prev) return prev;
        const stillAwaitingSameGate =
          (prev.status === "awaiting_review" ||
            prev.status === "awaiting_tool_approval") &&
          prev.currentNodeId === submittedNodeId;
        if (!stillAwaitingSameGate) return prev;
        return {
          ...prev,
          status: approved ? "running" : "failed",
        };
      });
      toast.success(
        approved
          ? "Approval submitted — resuming workflow"
          : "Run rejected and stopped",
      );
    } finally {
      setIsApproving(false);
    }
  };

  const handleSubmitReview = async (approved: boolean, feedback?: string) => {
    await submitApproval(approved, { feedback });
  };

  const handleSubmitToolDecisions = async (
    approved: boolean,
    toolDecisions: Record<string, boolean>,
  ) => {
    await submitApproval(approved, { toolDecisions });
  };

  return {
    run,
    setRun,
    workflow,
    nodeStates,
    setNodeStates,
    selectedNodeId,
    setSelectedNodeId,
    isArtifactOpen,
    setIsArtifactOpen,
    isLoading,
    loadError,
    retryLoad: loadRunData,
    isApproving,
    attachmentMeta,
    loadAttachmentUrls,
    handleSubmitReview,
    handleSubmitToolDecisions,
  };
}
