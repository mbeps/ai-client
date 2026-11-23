"use client";

import { Ban, Check, ShieldAlert, ShieldCheck, Undo2 } from "lucide-react";
import { useCallback, useState } from "react";
import { toast } from "sonner";
import { updateMcpToolApprovals } from "@/actions/mcp-servers/update-mcp-tool-approvals";
import { updateInternalToolApproval } from "@/actions/user-settings/update-internal-tool-approval";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { getInternalToolDisplayName } from "@/config/tools";
import { useApprovalRound } from "@/hooks/chat/use-approval-round";
import { useAppStore } from "@/lib/store/use-app-store";
import type { ApprovalDecision, PendingApproval } from "@/types/tool/approval";

/**
 * Props for the global sequential {@link ToolApprovalDialog}.
 */
export interface ToolApprovalDialogProps {
  pendingApprovals: PendingApproval[];
  onSubmit: (
    decisions: ApprovalDecision[],
  ) => void | boolean | Promise<void> | Promise<boolean>;
  disabled?: boolean;
}

/**
 * Formats tool call arguments as indented JSON for inspection before approval.
 */
function formatToolArgs(args: unknown): string {
  try {
    return JSON.stringify(args ?? {}, null, 2) ?? "{}";
  } catch {
    return String(args);
  }
}

/**
 * Resolves the existing auto-approved tool allowlist for an MCP server from
 * client store state so appending a new "Always allow" entry preserves prior
 * server permissions.
 */
function resolveExistingServerAllowlist(serverId: string): string[] {
  const { mcpServers, publicMcpServers } = useAppStore.getState();
  const match =
    mcpServers.find((s) => s.id === serverId) ??
    publicMcpServers.find((s) => s.id === serverId);
  return match?.autoApprovedTools ?? [];
}

/**
 * Global sequential tool execution approval card docked above the chat composer.
 * Presents blocked tool calls one at a time (`1 of N`) in emission order so
 * dependent calls cannot execute out of order.
 */
export function ToolApprovalDialog({
  pendingApprovals,
  onSubmit,
  disabled = false,
}: ToolApprovalDialogProps) {
  const [isPersistingRule, setIsPersistingRule] = useState(false);
  const isBusy = disabled || isPersistingRule;

  const {
    currentIndex,
    currentApproval,
    totalCount,
    canGoBack,
    decideCurrent,
    decideAll,
    goBack,
  } = useApprovalRound(pendingApprovals, onSubmit, isBusy);

  const handleAlwaysAllow = useCallback(async () => {
    if (!currentApproval || isBusy) return;
    setIsPersistingRule(true);

    try {
      if (currentApproval.serverId) {
        const existing = resolveExistingServerAllowlist(
          currentApproval.serverId,
        );
        const res = await updateMcpToolApprovals({
          serverId: currentApproval.serverId,
          autoApprovedTools: [...existing, currentApproval.toolName],
        });
        if (!res.ok) {
          toast.error(res.error.message);
          return;
        }
        await useAppStore.getState().loadMcpServers?.();
      } else {
        const res = await updateInternalToolApproval({
          toolName: currentApproval.toolName,
          approval: "auto",
        });
        if (!res.ok) {
          toast.error(res.error.message);
          return;
        }
      }

      decideCurrent(true);
    } finally {
      setIsPersistingRule(false);
    }
  }, [currentApproval, decideCurrent, isBusy]);

  if (totalCount === 0 || !currentApproval) {
    return null;
  }

  const displayName =
    getInternalToolDisplayName(currentApproval.toolName) ??
    currentApproval.toolName;
  const sourceLabel = currentApproval.serverName ?? "Built-in";

  return (
    <div
      role="dialog"
      aria-label="Tool execution approval"
      className="bg-background/95 mx-auto mb-2 w-full max-w-4xl rounded-xl border border-amber-500/40 p-3 shadow-md backdrop-blur-sm"
    >
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <ShieldAlert className="h-4 w-4 shrink-0 text-amber-500" />
          <span className="text-sm font-semibold">Tool Approval Required</span>
          {totalCount > 1 && (
            <Badge variant="secondary" className="font-mono text-xs">
              {currentIndex + 1} of {totalCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {currentApproval.subagentName && (
            <Badge
              variant="secondary"
              className="border-purple-500/30 bg-purple-500/10 text-xs text-purple-700 dark:text-purple-300"
            >
              Subagent: {currentApproval.subagentName}
            </Badge>
          )}
          <Badge variant="outline" className="text-xs">
            {sourceLabel}
          </Badge>
        </div>
      </div>

      <Accordion
        type="single"
        collapsible
        className="mb-2.5 rounded-lg border px-3"
      >
        <AccordionItem value="tool-call">
          <AccordionTrigger className="items-center py-2.5 hover:no-underline">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="text-sm font-medium">{displayName}</span>
              <code className="bg-muted text-muted-foreground rounded px-1.5 py-0.5 font-mono text-xs">
                {currentApproval.toolName}
              </code>
            </div>
          </AccordionTrigger>
          <AccordionContent className="space-y-1.5 pb-2.5">
            {currentApproval.reason && (
              <p className="text-muted-foreground text-xs">
                {currentApproval.reason}
              </p>
            )}
            <pre className="bg-muted/60 max-h-44 overflow-y-auto rounded-md border p-2 font-mono text-xs break-words whitespace-pre-wrap">
              {formatToolArgs(currentApproval.args)}
            </pre>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {canGoBack && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={goBack}
              disabled={isBusy}
            >
              <Undo2 className="mr-1 h-3.5 w-3.5" />
              Back
            </Button>
          )}
          {totalCount > 1 && (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => decideAll(false)}
                disabled={isBusy}
              >
                Deny All
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => decideAll(true)}
                disabled={isBusy}
              >
                Approve All ({totalCount})
              </Button>
            </>
          )}
        </div>

        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => decideCurrent(false)}
            disabled={isBusy}
          >
            <Ban className="mr-1 h-3.5 w-3.5" />
            Deny
          </Button>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => void handleAlwaysAllow()}
            disabled={isBusy}
          >
            <ShieldCheck className="mr-1 h-3.5 w-3.5" />
            Always Allow
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={() => decideCurrent(true)}
            disabled={isBusy}
          >
            <Check className="mr-1 h-3.5 w-3.5" />
            Approve
          </Button>
        </div>
      </div>
    </div>
  );
}
