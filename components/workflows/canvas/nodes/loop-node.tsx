"use client";

import { Handle, Position } from "@xyflow/react";
import { Repeat } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  BaseWorkflowNode,
  type WorkflowCanvasNodeData,
} from "@/components/workflows/canvas/base-workflow-node";
import type { LoopNodeData } from "@/types/workflows/workflow";

/**
 * Custom React Flow loop node exposing explicit `body` (per-iteration sub-DAG)
 * and `done` (post-loop continuation) right source handles.
 */
export function LoopNode({
  id,
  selected,
  data,
}: {
  id: string;
  selected?: boolean;
  data: WorkflowCanvasNodeData;
}) {
  const nodeData = data.nodeData as LoopNodeData;

  return (
    <BaseWorkflowNode
      id={id}
      selected={selected}
      data={data}
      icon={<Repeat className="h-4 w-4 text-violet-500" />}
      accentClassName="border-violet-500/30 bg-violet-500/10"
      hasSourceHandle={false}
      customSourceHandles={
        <>
          <div className="pointer-events-none absolute top-1/3 right-2.5 -translate-y-1/2 text-[10px] font-medium text-violet-600 dark:text-violet-400">
            Body
          </div>
          <Handle
            id="body"
            type="source"
            position={Position.Right}
            style={{ top: "33%" }}
            className="!border-background !h-3 !w-3 !border-2 !bg-violet-500"
          />
          <div className="text-muted-foreground pointer-events-none absolute top-2/3 right-2.5 -translate-y-1/2 text-[10px] font-medium">
            Done
          </div>
          <Handle
            id="done"
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
          {nodeData.mode === "for_each" ? "For Each" : "Count"}
        </Badge>
        <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
          {nodeData.mode === "count"
            ? `${nodeData.count ?? 1}x`
            : `max ${nodeData.maxIterations}`}
        </Badge>
      </div>
    </BaseWorkflowNode>
  );
}
