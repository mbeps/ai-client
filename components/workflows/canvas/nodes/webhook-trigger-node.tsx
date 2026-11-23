"use client";

import { Webhook } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  BaseWorkflowNode,
  type WorkflowCanvasNodeData,
} from "@/components/workflows/canvas/base-workflow-node";

/**
 * Custom React Flow node for inbound HTTP Webhook Triggers.
 */
export function WebhookTriggerNode({
  id,
  selected,
  data,
}: {
  id: string;
  selected?: boolean;
  data: WorkflowCanvasNodeData;
}) {
  return (
    <BaseWorkflowNode
      id={id}
      selected={selected}
      data={data}
      icon={<Webhook className="h-4 w-4 text-violet-500" />}
      accentClassName="border-violet-500/30 bg-violet-500/10"
      hasTargetHandle={false}
    >
      <div className="flex flex-wrap items-center gap-1.5">
        <Badge variant="secondary" className="px-1.5 py-0 text-[10px]">
          POST
        </Badge>
        <Badge variant="outline" className="px-1.5 py-0 text-[10px]">
          Webhook
        </Badge>
      </div>
    </BaseWorkflowNode>
  );
}
