"use client";

import { Handle, Position } from "@xyflow/react";
import { GitBranch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  BaseWorkflowNode,
  type WorkflowCanvasNodeData,
} from "@/components/workflows/canvas/base-workflow-node";
import type { IfConditionNodeData } from "@/types/workflows/workflow";

const MODE_LABELS: Record<IfConditionNodeData["evaluationMode"], string> = {
  deterministic: "Rules",
  llm: "LLM",
  hybrid: "Hybrid",
};

/**
 * Custom React Flow branching node exposing explicit `true` and `false` right source handles.
 */
export function IfConditionNode({
  id,
  selected,
  data,
}: {
  id: string;
  selected?: boolean;
  data: WorkflowCanvasNodeData;
}) {
  const nodeData = data.nodeData as IfConditionNodeData;

  return (
    <BaseWorkflowNode
      id={id}
      selected={selected}
      data={data}
      icon={<GitBranch className="h-4 w-4 text-amber-500" />}
      accentClassName="border-amber-500/30 bg-amber-500/10"
      hasSourceHandle={false}
      customSourceHandles={
        <>
          <div className="pointer-events-none absolute top-1/3 right-2.5 -translate-y-1/2 text-[10px] font-medium text-emerald-600 dark:text-emerald-400">
            True
          </div>
          <Handle
            id="true"
            type="source"
            position={Position.Right}
            style={{ top: "33%" }}
            className="!border-background !h-3 !w-3 !border-2 !bg-emerald-500"
          />
          <div className="text-muted-foreground pointer-events-none absolute top-2/3 right-2.5 -translate-y-1/2 text-[10px] font-medium">
            False
          </div>
          <Handle
            id="false"
            type="source"
            position={Position.Right}
            style={{ top: "67%" }}
            className="!border-background !bg-muted-foreground !h-3 !w-3 !border-2"
          />
        </>
      }
    >
      <div className="flex flex-wrap items-center gap-1.5 pr-8">
        <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
          {MODE_LABELS[nodeData.evaluationMode]}
        </Badge>
        {nodeData.rules.length > 0 && (
          <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
            {nodeData.rules.length}{" "}
            {nodeData.rules.length === 1 ? "rule" : "rules"}
          </Badge>
        )}
      </div>
    </BaseWorkflowNode>
  );
}
