"use client";

import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { getAttachmentUrl } from "@/actions/attachments/get-attachment-url";
import { approveWorkflowRunAction } from "@/actions/workflow-runs/approve-workflow-run";
import { getWorkflowRun } from "@/actions/workflow-runs/get-workflow-run";
import { getWorkflow } from "@/actions/workflows/get-workflow";
import { mapRunRowToWorkflowRun } from "@/components/workflows/run/state-helpers";
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
  const [isApproving, setIsApproving] = useState(false);
  const [attachmentMeta, setAttachmentMeta] = useState<
    Record<string, { url: string; name: string }>
  >({});

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

  useEffect(() => {
    let mounted = true;
    async function load() {
      const runRes = await getWorkflowRun(runId);
      if (!runRes.ok || !runRes.value) {
        if (mounted) setIsLoading(false);
        return;
      }

      const mapped = mapRunRowToWorkflowRun(runRes.value);
      const wfRes = await getWorkflow(mapped.workflowId);
      if (!mounted) return;

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
      setIsLoading(false);
    }

    load();
    return () => {
      mounted = false;
    };
  }, [runId, loadAttachmentUrls]);

  const submitApproval = async (
    approved: boolean,
    options?: { feedback?: string; toolDecisions?: Record<string, boolean> },
  ) => {
    if (!run?.currentNodeId) return;
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
        nodeId: run.currentNodeId,
        approved,
        feedback: options?.feedback || undefined,
        toolDecisions: formattedDecisions,
      });
      if (!res.ok) {
        toast.error(res.error.message || "Failed to submit approval");
        return;
      }
      setRun((prev) =>
        prev
          ? {
              ...prev,
              status: approved ? "running" : "failed",
            }
          : prev,
      );
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
    isApproving,
    attachmentMeta,
    loadAttachmentUrls,
    handleSubmitReview,
    handleSubmitToolDecisions,
  };
}
