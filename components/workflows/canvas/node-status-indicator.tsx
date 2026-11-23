"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { WorkflowNodeRunState } from "@/types/workflows/workflow";

export type WorkflowVisualNodeStatus = WorkflowNodeRunState["status"];

const STATUS_RING_CLASSES: Record<WorkflowVisualNodeStatus, string> = {
  pending: "border-border",
  running:
    "border-sky-500 ring-2 ring-sky-500/30 shadow-[0_0_18px_rgba(14,165,233,0.25)]",
  completed: "border-emerald-500/80 ring-1 ring-emerald-500/20",
  awaiting_review: "border-amber-500 ring-2 ring-amber-500/30 animate-pulse",
  awaiting_tool_approval:
    "border-amber-500 ring-2 ring-amber-500/30 animate-pulse",
  skipped: "border-dashed border-muted-foreground/40 opacity-55",
  failed: "border-destructive ring-2 ring-destructive/25",
};

/**
 * Wraps a workflow node card with status-aware border and glow feedback during live runs.
 */
export function NodeStatusIndicator({
  status,
  selected,
  children,
}: {
  status?: WorkflowVisualNodeStatus;
  selected?: boolean;
  children: ReactNode;
}) {
  const effectiveStatus = status ?? "pending";

  return (
    <div
      data-node-status={effectiveStatus}
      className={cn(
        "bg-card relative rounded-xl border-2 transition-all duration-200",
        STATUS_RING_CLASSES[effectiveStatus],
        selected && "ring-primary/40 border-primary ring-2",
      )}
    >
      {effectiveStatus === "running" && (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -top-1 -right-1 flex size-3"
        >
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sky-400 opacity-75" />
          <span className="relative inline-flex size-3 rounded-full bg-sky-500" />
        </span>
      )}
      {children}
    </div>
  );
}
