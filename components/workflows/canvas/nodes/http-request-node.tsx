"use client";

import { Globe } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  BaseWorkflowNode,
  type WorkflowCanvasNodeData,
} from "@/components/workflows/canvas/base-workflow-node";
import type { HttpRequestNodeData } from "@/types/workflows/workflow";

/**
 * Custom React Flow node for outbound HTTP requests.
 */
export function HttpRequestNode({
  id,
  selected,
  data,
}: {
  id: string;
  selected?: boolean;
  data: WorkflowCanvasNodeData;
}) {
  const nodeData = data.nodeData as HttpRequestNodeData;

  return (
    <BaseWorkflowNode
      id={id}
      selected={selected}
      data={data}
      icon={<Globe className="h-4 w-4 text-sky-500" />}
      accentClassName="border-sky-500/30 bg-sky-500/10"
    >
      <div className="flex items-center gap-1.5">
        <Badge
          variant="secondary"
          className="px-1.5 py-0 font-mono text-[10px]"
        >
          {nodeData.method}
        </Badge>
        <span className="text-muted-foreground truncate font-mono text-[11px]">
          {nodeData.url || "Configure URL..."}
        </span>
      </div>
    </BaseWorkflowNode>
  );
}
