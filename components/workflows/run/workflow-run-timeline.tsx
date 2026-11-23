"use client";

import { WorkflowRunNodeCard } from "@/components/workflows/run/workflow-run-node-card";
import type {
  WorkflowNode,
  WorkflowNodeRunState,
} from "@/types/workflows/workflow";

/** Props for {@link WorkflowRunTimeline}. */
export interface WorkflowRunTimelineProps {
  nodes: WorkflowNode[];
  nodeStates: Record<string, WorkflowNodeRunState>;
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

/**
 * Scrollable chronological node execution trace for a workflow run.
 */
export function WorkflowRunTimeline({
  nodes,
  nodeStates,
  selectedNodeId,
  onSelectNode,
}: WorkflowRunTimelineProps) {
  return (
    <div className="space-y-3 p-4">
      {nodes.map((node) => (
        <WorkflowRunNodeCard
          key={node.id}
          node={node}
          state={nodeStates[node.id]}
          isSelected={selectedNodeId === node.id}
          onClick={() => onSelectNode(node.id)}
        />
      ))}
    </div>
  );
}
