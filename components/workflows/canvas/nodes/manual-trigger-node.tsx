"use client";

import { Play } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  BaseWorkflowNode,
  type WorkflowCanvasNodeData,
} from "@/components/workflows/canvas/base-workflow-node";
import type { ManualTriggerNodeData } from "@/types/workflows/workflow";

/**
 * Custom React Flow node for Manual Workflow Triggers.
 */
export function ManualTriggerNode({
  id,
  selected,
  data,
}: {
  id: string;
  selected?: boolean;
  data: WorkflowCanvasNodeData;
}) {
  const nodeData = data.nodeData as ManualTriggerNodeData;

  return (
    <BaseWorkflowNode
      id={id}
      selected={selected}
      data={data}
      icon={<Play className="h-4 w-4 text-emerald-500" />}
      accentClassName="border-emerald-500/30 bg-emerald-500/10"
      hasTargetHandle={false}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
          Trigger
        </Badge>
        {nodeData.requiresFileUpload && (
          <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
            Files
          </Badge>
        )}
      </div>
    </BaseWorkflowNode>
  );
}
