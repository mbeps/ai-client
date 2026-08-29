"use client";

import { Loader2 } from "lucide-react";
import { TransformRunCard } from "@/components/workflows/sheet-flow/transform-run-card";
import type { TransformRunRow } from "@/types/transform/transform-run-row";

export interface TransformRunsTabProps {
  runs: TransformRunRow[];
  agentId: string;
  isLoading?: boolean;
}

/**
 * Execution history list tab for a Transform Agent.
 *
 * @author Maruf Bepary
 */
export function TransformRunsTab({
  runs,
  agentId,
  isLoading = false,
}: TransformRunsTabProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold">Run History</h3>
        <p className="text-sm text-muted-foreground">
          History of transformations executed by this agent.
        </p>
      </div>
      {isLoading ? (
        <div className="flex h-32 items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : runs.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed p-12 text-center text-muted-foreground">
          <p>No runs yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {runs.map((run) => (
            <TransformRunCard key={run.id} run={run} agentId={agentId} />
          ))}
        </div>
      )}
    </div>
  );
}
export default TransformRunsTab;
