"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { NodeStatusIndicator } from "@/components/workflows/canvas/node-status-indicator";
import { cn } from "@/lib/utils";
import type {
  WorkflowNode,
  WorkflowNodeRunState,
} from "@/types/workflows/workflow";

/** Props for {@link WorkflowRunNodeCard}. */
export interface WorkflowRunNodeCardProps {
  node: WorkflowNode;
  state?: WorkflowNodeRunState;
  isSelected: boolean;
  onClick: () => void;
}

/**
 * Execution timeline card summarizing per-node status, branches, HTTP responses, and tool calls.
 */
export function WorkflowRunNodeCard({
  node,
  state,
  isSelected,
  onClick,
}: WorkflowRunNodeCardProps) {
  const status = state?.status ?? "pending";

  return (
    <Card
      onClick={onClick}
      className={cn(
        "cursor-pointer transition-colors",
        isSelected
          ? "border-primary ring-primary/20 ring-2"
          : "hover:border-primary/40",
      )}
    >
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <NodeStatusIndicator status={status}>
              <span className="m-1 block h-2 w-2 rounded-full bg-current" />
            </NodeStatusIndicator>
            <span className="font-medium">{node.name}</span>
            <Badge variant="outline" className="font-mono text-[10px]">
              {`{{${node.data.variableName}}}`}
            </Badge>
          </div>
          <Badge variant="secondary" className="text-[11px] capitalize">
            {status.replaceAll("_", " ")}
          </Badge>
        </div>

        {state?.branchTaken && (
          <div className="flex flex-wrap items-center gap-2 text-xs">
            <Badge
              variant="outline"
              className={
                state.branchTaken === "true"
                  ? "border-emerald-500 text-emerald-600"
                  : "border-rose-500 text-rose-600"
              }
            >
              Branch: {state.branchTaken}
            </Badge>
            {state.conditionReasoning && (
              <span className="text-muted-foreground">
                {state.conditionReasoning}
              </span>
            )}
          </div>
        )}

        {state?.httpResponse && (
          <p className="text-muted-foreground font-mono text-xs">
            HTTP {state.httpResponse.status} {state.httpResponse.statusText}
          </p>
        )}

        {state?.summary && (
          <p className="text-muted-foreground line-clamp-2 text-xs">
            {state.summary}
          </p>
        )}

        {state?.toolCalls && state.toolCalls.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {state.toolCalls.map((call) => (
              <Badge
                key={call.toolCallId}
                variant="outline"
                className="font-mono text-[10px]"
              >
                {call.toolName}
              </Badge>
            ))}
          </div>
        )}

        {state?.errorMessage && (
          <p className="text-destructive text-xs">{state.errorMessage}</p>
        )}
      </CardContent>
    </Card>
  );
}
