"use client";

import { Sparkles } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  BaseWorkflowNode,
  type WorkflowCanvasNodeData,
} from "@/components/workflows/canvas/base-workflow-node";
import type { AiStepNodeData } from "@/types/workflows/workflow";

/**
 * Custom React Flow node for AI Step execution.
 */
export function AiStepNode({
  id,
  selected,
  data,
}: {
  id: string;
  selected?: boolean;
  data: WorkflowCanvasNodeData;
}) {
  const nodeData = data.nodeData as AiStepNodeData;

  return (
    <BaseWorkflowNode
      id={id}
      selected={selected}
      data={data}
      icon={<Sparkles className="text-primary h-4 w-4" />}
      accentClassName="border-primary/30 bg-primary/10"
    >
      {nodeData.prompt && (
        <p className="text-muted-foreground line-clamp-2 text-xs">
          {nodeData.prompt}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-1.5">
        {data.missingAgent ? (
          <Badge variant="destructive" className="px-1.5 py-0 text-[10px]">
            Missing agent
          </Badge>
        ) : data.linkedAgent ? (
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
            {data.linkedAgent.name}
          </Badge>
        ) : null}
        {!nodeData.agentId && !nodeData.prompt?.trim() && (
          <Badge
            variant="outline"
            className="border-destructive/40 bg-destructive/10 text-destructive px-1.5 py-0 text-[10px]"
          >
            Needs info
          </Badge>
        )}
        {nodeData.toolIds.length > 0 && (
          <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
            {nodeData.toolIds.length}{" "}
            {nodeData.toolIds.length === 1 ? "tool" : "tools"}
          </Badge>
        )}
        {nodeData.requiresReview && (
          <Badge
            variant="outline"
            className="border-amber-500/40 bg-amber-500/10 px-1.5 py-0 text-[10px] text-amber-600 dark:text-amber-400"
          >
            Review
          </Badge>
        )}
        {nodeData.outputMode === "structured" ? (
          <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
            JSON
          </Badge>
        ) : (
          nodeData.canvasMode &&
          nodeData.canvasMode !== "inherit" &&
          nodeData.canvasMode !== "disabled" && (
            <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
              {nodeData.canvasMode}
            </Badge>
          )
        )}
      </div>
    </BaseWorkflowNode>
  );
}
