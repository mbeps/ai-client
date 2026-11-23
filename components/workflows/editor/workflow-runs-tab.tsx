"use client";

import { Loader2 } from "lucide-react";
import { WorkflowRunCard } from "@/components/workflows/editor/workflow-run-card";
import type { WorkflowRunItem } from "@/types/workflows/workflow";

/** Props for {@link WorkflowRunsTab}. */
export interface WorkflowRunsTabProps {
  runs: WorkflowRunItem[];
  workflowId: string;
  isLoading?: boolean;
}

/**
 * Execution run history list tab inside the workflow editor.
 */
export function WorkflowRunsTab({
  runs,
  workflowId,
  isLoading = false,
}: WorkflowRunsTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Run History</h3>
        <p className="text-muted-foreground text-sm">
          Past manual and webhook executions for this workflow.
        </p>
      </div>
      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="text-muted-foreground h-6 w-6 animate-spin" />
        </div>
      ) : runs.length === 0 ? (
        <div className="text-muted-foreground flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center">
          <p>No runs yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => (
            <WorkflowRunCard key={run.id} run={run} workflowId={workflowId} />
          ))}
        </div>
      )}
    </div>
  );
}
