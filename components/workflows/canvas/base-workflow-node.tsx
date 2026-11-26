"use client";

import { Handle, Position } from "@xyflow/react";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import {
  NodeStatusIndicator,
  type WorkflowVisualNodeStatus,
} from "@/components/workflows/canvas/node-status-indicator";
import { cn } from "@/lib/utils";
import type { WorkflowNodeData } from "@/types/workflows/workflow";

export interface WorkflowCanvasNodeData {
  label: string;
  nodeData: WorkflowNodeData;
  status?: WorkflowVisualNodeStatus;
  linkedAgent?: { id: string; name: string } | null;
  missingAgent?: boolean;
  onConfigure?: (nodeId: string) => void;
  onDelete?: (nodeId: string) => void;
  readOnly?: boolean;
  [key: string]: unknown;
}

export interface BaseWorkflowNodeProps {
  id: string;
  selected?: boolean;
  data: WorkflowCanvasNodeData;
  icon: ReactNode;
  accentClassName?: string;
  hasTargetHandle?: boolean;
  hasSourceHandle?: boolean;
  customSourceHandles?: ReactNode;
  children?: ReactNode;
}

/**
 * Shared visual node shell with typed handles, variable badge, and live status ring.
 */
export function BaseWorkflowNode({
  id,
  selected,
  data,
  icon,
  accentClassName,
  hasTargetHandle = true,
  hasSourceHandle = true,
  customSourceHandles,
  children,
}: BaseWorkflowNodeProps) {
  return (
    <NodeStatusIndicator status={data.status} selected={selected}>
      {hasTargetHandle && (
        <Handle
          id="main"
          type="target"
          position={Position.Left}
          className="!bg-primary !border-background !h-3 !w-3 !border-2"
        />
      )}

      <div
        className="w-64 cursor-pointer p-3"
        onDoubleClick={() => {
          if (!data.readOnly) data.onConfigure?.(id);
        }}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="flex min-w-0 items-center gap-2">
            <div
              className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border",
                accentClassName ?? "bg-muted text-foreground",
              )}
            >
              {icon}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold">{data.label}</p>
              <p className="text-muted-foreground truncate font-mono text-[11px]">
                {`{{${data.nodeData.variableName}}}`}
              </p>
            </div>
          </div>

          {data.status && data.status !== "pending" && (
            <Badge
              variant="outline"
              className="shrink-0 px-1.5 py-0 text-[10px] capitalize"
            >
              {data.status.replace(/_/g, " ")}
            </Badge>
          )}
        </div>

        {children && <div className="mt-2.5 space-y-1.5">{children}</div>}
      </div>

      {hasSourceHandle && !customSourceHandles && (
        <Handle
          id="main"
          type="source"
          position={Position.Right}
          className="!bg-primary !border-background !h-3 !w-3 !border-2"
        />
      )}

      {customSourceHandles}
    </NodeStatusIndicator>
  );
}
