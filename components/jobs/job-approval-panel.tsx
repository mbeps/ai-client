"use client";

import {
  Check,
  CheckCircle2,
  Loader2,
  ShieldAlert,
  X,
  XCircle,
} from "lucide-react";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getInternalToolDisplayName } from "@/config/tools";
import type { JobApprovalInfo } from "@/types/jobs";
import type { ApprovalDecision, PendingApproval } from "@/types/tool/approval";

/**
 * Props for {@link JobApprovalPanel}.
 */
export interface JobApprovalPanelProps {
  approval: JobApprovalInfo;
  isSubmitting: boolean;
  onApproveWorkflowReview: (
    approval: Extract<JobApprovalInfo, { kind: "workflow-review" }>,
    approved: boolean,
    feedback?: string,
  ) => Promise<void> | void;
  onSubmitToolDecisions: (
    approval: Extract<JobApprovalInfo, { kind: "workflow-tool" | "chat-tool" }>,
    approved: boolean,
    decisions: ApprovalDecision[],
  ) => Promise<void> | void;
}

function formatCompactArgs(args: unknown): string {
  try {
    return JSON.stringify(args ?? {});
  } catch {
    return String(args);
  }
}

function buildDecisions(
  pendingApprovals: readonly PendingApproval[],
  decisionMap: Record<string, boolean>,
  overrideAll?: boolean,
): ApprovalDecision[] {
  return pendingApprovals.map((item) => ({
    approvalId: item.approvalId,
    approved: overrideAll ?? decisionMap[item.approvalId] ?? true,
  }));
}

/**
 * Inline approval panel rendered inside a job card when a workflow run or chat
 * is paused waiting for human review or tool execution approval.
 */
export function JobApprovalPanel({
  approval,
  isSubmitting,
  onApproveWorkflowReview,
  onSubmitToolDecisions,
}: JobApprovalPanelProps) {
  const [feedback, setFeedback] = useState("");
  const [toolDecisions, setToolDecisions] = useState<Record<string, boolean>>(
    {},
  );

  if (approval.kind === "workflow-review") {
    return (
      <div className="border-t border-amber-500/20 bg-amber-500/[0.04] px-3.5 py-3">
        <div className="flex flex-wrap items-center gap-2">
          <ShieldAlert className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
          <span className="text-xs font-semibold text-amber-900 dark:text-amber-200">
            Human Review Required
            {approval.nodeName ? ` — ${approval.nodeName}` : ""}
          </span>
          {approval.reviewPhase && (
            <Badge
              variant="outline"
              className="border-amber-500/30 text-[10px] text-amber-700 dark:text-amber-300"
            >
              {approval.reviewPhase} step
            </Badge>
          )}
        </div>

        <div className="mt-2.5 flex flex-col gap-2 sm:flex-row sm:items-center">
          <Input
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            placeholder="Optional review feedback..."
            aria-label="Review feedback"
            disabled={isSubmitting}
            className="bg-background h-8 flex-1 text-xs"
          />
          <div className="flex shrink-0 items-center gap-1.5">
            <Button
              type="button"
              size="sm"
              className="h-8 text-xs"
              disabled={isSubmitting}
              onClick={() =>
                onApproveWorkflowReview(
                  approval,
                  true,
                  feedback.trim() || undefined,
                )
              }
            >
              {isSubmitting ? (
                <Loader2 className="mr-1.5 size-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="mr-1.5 size-3.5" />
              )}
              Approve
            </Button>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="h-8 text-xs"
              disabled={isSubmitting}
              onClick={() =>
                onApproveWorkflowReview(
                  approval,
                  false,
                  feedback.trim() || undefined,
                )
              }
            >
              <XCircle className="mr-1.5 size-3.5" />
              Reject
            </Button>
          </div>
        </div>
      </div>
    );
  }

  const { pendingApprovals } = approval;
  const isMultiple = pendingApprovals.length > 1;
  const nodeLabel =
    approval.kind === "workflow-tool" && approval.nodeName
      ? ` — ${approval.nodeName}`
      : "";

  return (
    <div className="border-t border-orange-500/20 bg-orange-500/[0.04] px-3.5 py-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="size-4 shrink-0 text-orange-600 dark:text-orange-400" />
          <span className="text-xs font-semibold text-orange-900 dark:text-orange-200">
            Tool Approval Required{nodeLabel}
          </span>
          <Badge
            variant="secondary"
            className="px-1.5 py-0 font-mono text-[10px] tabular-nums"
          >
            {pendingApprovals.length} pending
          </Badge>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {isMultiple ? (
            <>
              <Button
                type="button"
                size="sm"
                className="h-7 px-2.5 text-xs"
                disabled={isSubmitting}
                onClick={() =>
                  onSubmitToolDecisions(
                    approval,
                    true,
                    buildDecisions(pendingApprovals, toolDecisions, true),
                  )
                }
              >
                {isSubmitting ? (
                  <Loader2 className="mr-1.5 size-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-1.5 size-3" />
                )}
                Approve All
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 px-2.5 text-xs"
                disabled={isSubmitting}
                onClick={() =>
                  onSubmitToolDecisions(
                    approval,
                    true,
                    buildDecisions(pendingApprovals, toolDecisions),
                  )
                }
              >
                Submit
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-7 px-2.5 text-xs"
                disabled={isSubmitting}
                onClick={() =>
                  onSubmitToolDecisions(
                    approval,
                    false,
                    buildDecisions(pendingApprovals, toolDecisions, false),
                  )
                }
              >
                <XCircle className="mr-1.5 size-3" />
                Reject
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                size="sm"
                className="h-7 px-2.5 text-xs"
                disabled={isSubmitting}
                onClick={() =>
                  onSubmitToolDecisions(
                    approval,
                    true,
                    buildDecisions(pendingApprovals, toolDecisions, true),
                  )
                }
              >
                {isSubmitting ? (
                  <Loader2 className="mr-1.5 size-3 animate-spin" />
                ) : (
                  <CheckCircle2 className="mr-1.5 size-3" />
                )}
                Approve
              </Button>
              <Button
                type="button"
                variant="destructive"
                size="sm"
                className="h-7 px-2.5 text-xs"
                disabled={isSubmitting}
                onClick={() =>
                  onSubmitToolDecisions(
                    approval,
                    false,
                    buildDecisions(pendingApprovals, toolDecisions, false),
                  )
                }
              >
                <XCircle className="mr-1.5 size-3" />
                Deny
              </Button>
            </>
          )}
        </div>
      </div>

      <div className="mt-2 space-y-1.5">
        {pendingApprovals.map((item) => {
          const displayName =
            getInternalToolDisplayName(item.toolName) ?? item.toolName;
          const argsText = formatCompactArgs(item.args);
          const allowed = toolDecisions[item.approvalId] ?? true;

          return (
            <div
              key={item.approvalId}
              className="bg-background/80 flex items-center justify-between gap-3 rounded-md border px-2.5 py-1.5 text-xs"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-mono font-medium">{displayName}</span>
                  {item.serverName && (
                    <Badge
                      variant="secondary"
                      className="px-1.5 py-0 text-[10px]"
                    >
                      {item.serverName}
                    </Badge>
                  )}
                  {item.subagentName && (
                    <Badge
                      variant="outline"
                      className="px-1.5 py-0 text-[10px]"
                    >
                      {item.subagentName}
                    </Badge>
                  )}
                </div>
                <p
                  title={argsText}
                  className="text-muted-foreground mt-0.5 truncate font-mono text-[11px]"
                >
                  {argsText}
                </p>
              </div>

              {isMultiple && (
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={allowed ? "default" : "outline"}
                    className="h-6 px-2 text-[11px]"
                    disabled={isSubmitting}
                    onClick={() =>
                      setToolDecisions((prev) => ({
                        ...prev,
                        [item.approvalId]: true,
                      }))
                    }
                  >
                    <Check className="mr-1 size-3" />
                    Allow
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={!allowed ? "destructive" : "outline"}
                    className="h-6 px-2 text-[11px]"
                    disabled={isSubmitting}
                    onClick={() =>
                      setToolDecisions((prev) => ({
                        ...prev,
                        [item.approvalId]: false,
                      }))
                    }
                  >
                    <X className="mr-1 size-3" />
                    Deny
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
