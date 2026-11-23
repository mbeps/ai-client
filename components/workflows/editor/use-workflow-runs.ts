"use client";

import { useEffect, useState } from "react";
import { listWorkflowRuns } from "@/actions/workflow-runs/list-workflow-runs";
import type { WorkflowRunItem } from "@/types/workflows/workflow";

/**
 * Loads past execution runs for a workflow inside the Runs tab.
 */
export function useWorkflowRuns(
  workflowId: string,
  isNew: boolean,
  handleApiError: (err: unknown, fallbackMessage?: string) => boolean,
) {
  const [runs, setRuns] = useState<WorkflowRunItem[]>([]);
  const [isLoadingRuns, setIsLoadingRuns] = useState(false);

  useEffect(() => {
    if (isNew) return;
    let mounted = true;
    async function load() {
      setIsLoadingRuns(true);
      try {
        const res = await listWorkflowRuns(workflowId);
        if (!res.ok) {
          handleApiError(res.error, "Failed to load workflow runs");
          return;
        }
        if (mounted) {
          setRuns(res.value as unknown as WorkflowRunItem[]);
        }
      } catch (err) {
        handleApiError(err, "Failed to load workflow runs");
      } finally {
        if (mounted) setIsLoadingRuns(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, [workflowId, isNew, handleApiError]);

  return { runs, isLoadingRuns };
}
