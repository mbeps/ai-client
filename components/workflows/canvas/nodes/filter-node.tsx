"use client";

import { Filter } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  BaseWorkflowNode,
  type WorkflowCanvasNodeData,
} from "@/components/workflows/canvas/base-workflow-node";
import type { FilterNodeData } from "@/types/workflows/workflow";

/**
 * Custom React Flow node for filtering an array of items via deterministic rules or LLM.
 */
export function FilterNode({
  id,
  selected,
  data,
}: {
  id: string;
  selected?: boolean;
  data: WorkflowCanvasNodeData;
}) {
  const nodeData = data.nodeData as FilterNodeData;

  return (
    <BaseWorkflowNode
      id={id}
      selected={selected}
      data={data}
      icon={<Filter className="h-4 w-4 text-sky-500" />}
      accentClassName="border-sky-500/30 bg-sky-500/10"
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
          {nodeData.evaluationMode === "deterministic" ? "Rules" : "LLM"}
        </Badge>
        {nodeData.evaluationMode === "deterministic" &&
          nodeData.rules.length > 0 && (
            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
              {nodeData.rules.length}{" "}
              {nodeData.rules.length === 1 ? "rule" : "rules"}
            </Badge>
          )}
      </div>
    </BaseWorkflowNode>
  );
}
