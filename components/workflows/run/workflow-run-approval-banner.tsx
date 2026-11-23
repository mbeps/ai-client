"use client";

import { CheckCircle2, ShieldAlert, XCircle } from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  WorkflowNode,
  WorkflowNodeRunState,
  WorkflowRunStatus,
} from "@/types/workflows/workflow";

/** Props for {@link WorkflowRunApprovalBanner}. */
export interface WorkflowRunApprovalBannerProps {
  status: WorkflowRunStatus;
  currentNode?: WorkflowNode | null;
  nodeState?: WorkflowNodeRunState;
  onSubmitReview: (
    approved: boolean,
    feedback?: string,
  ) => Promise<void> | void;
  onSubmitToolDecisions: (
    approved: boolean,
    toolDecisions: Record<string, boolean>,
  ) => Promise<void> | void;
  isSubmitting: boolean;
}

/**
 * Interactive banner surfacing human review gates and pending tool call approval requests.
 */
export function WorkflowRunApprovalBanner({
  status,
  currentNode,
  nodeState,
  onSubmitReview,
  onSubmitToolDecisions,
  isSubmitting,
}: WorkflowRunApprovalBannerProps) {
  const [feedback, setFeedback] = useState("");
  const [decisions, setDecisions] = useState<Record<string, boolean>>({});

  if (status !== "awaiting_review" && status !== "awaiting_tool_approval") {
    return null;
  }

  const approvals = nodeState?.pendingToolApprovals ?? [];
  const resolveKey = (item: { approvalId?: string; toolCallId: string }) =>
    item.approvalId || item.toolCallId;
  const resolveDecision = (key: string) => decisions[key] ?? true;

  if (status === "awaiting_review") {
    return (
      <div className="mx-4 mt-4 flex flex-col gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-semibold">
              Human Review Required
              {currentNode ? ` — ${currentNode.name}` : ""}
            </span>
            {nodeState?.reviewPhase && (
              <Badge variant="outline">{nodeState.reviewPhase} step</Badge>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Input
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Optional review feedback or guidance..."
            className="bg-background max-w-md flex-1 text-sm"
          />
          <Button
            type="button"
            size="sm"
            disabled={isSubmitting}
            onClick={() => onSubmitReview(true, feedback)}
          >
            <CheckCircle2 className="mr-1.5 h-3.5 w-3.5" />
            Approve &amp; Continue
          </Button>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            disabled={isSubmitting}
            onClick={() => onSubmitReview(false, feedback)}
          >
            <XCircle className="mr-1.5 h-3.5 w-3.5" />
            Reject &amp; Stop
          </Button>
        </div>
      </div>
    );
  }

  const buildAllMap = (allowAll: boolean) => {
    const map: Record<string, boolean> = {};
    for (const item of approvals) {
      map[resolveKey(item)] = allowAll;
    }
    return map;
  };

  const buildCurrentMap = () => {
    const map: Record<string, boolean> = {};
    for (const item of approvals) {
      const key = resolveKey(item);
      map[key] = resolveDecision(key);
    }
    return map;
  };

  return (
    <div className="mx-4 mt-4 flex flex-col gap-3 rounded-lg border border-orange-500/40 bg-orange-500/10 p-4">
      <div className="flex items-center gap-2">
        <ShieldAlert className="h-4 w-4 text-orange-600" />
        <span className="text-sm font-semibold">
          Tool Execution Approval Required
          {currentNode ? ` — ${currentNode.name}` : ""}
        </span>
      </div>

      <div className="space-y-2">
        {approvals.map((item) => {
          const key = resolveKey(item);
          const allowed = resolveDecision(key);
          return (
            <div
              key={key}
              className="bg-background flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-xs"
            >
              <div className="space-y-0.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono font-semibold">
                    {item.toolName}
                  </span>
                  <Badge variant="secondary">{item.serverName}</Badge>
                </div>
                <pre className="text-muted-foreground max-w-xl truncate font-mono text-[11px]">
                  {JSON.stringify(item.args)}
                </pre>
              </div>

              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  size="sm"
                  variant={allowed ? "default" : "outline"}
                  onClick={() =>
                    setDecisions((prev) => ({
                      ...prev,
                      [key]: true,
                    }))
                  }
                >
                  Allow
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={!allowed ? "destructive" : "outline"}
                  onClick={() =>
                    setDecisions((prev) => ({
                      ...prev,
                      [key]: false,
                    }))
                  }
                >
                  Deny
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Button
          type="button"
          size="sm"
          disabled={isSubmitting}
          onClick={() => onSubmitToolDecisions(true, buildAllMap(true))}
        >
          Approve All &amp; Resume
        </Button>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isSubmitting}
          onClick={() => onSubmitToolDecisions(true, buildCurrentMap())}
        >
          Submit Decisions
        </Button>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={isSubmitting}
          onClick={() => onSubmitToolDecisions(false, buildAllMap(false))}
        >
          Reject &amp; Stop
        </Button>
      </div>
    </div>
  );
}
