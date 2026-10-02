"use client";

import { useMemo } from "react";
import type { ToolCall } from "@/types/chat/tool-call";
import type { ToolResult } from "@/types/chat/tool-result";
import type { ApprovalDecision, PendingApproval } from "@/types/tool/approval";
import type { ToolCallState } from "@/types/tool/tool-call";
import { ThinkingDisplay } from "./thinking-display";
import { ToolCallDisplay } from "./tool-call-display";

interface ResponseTimelineProps {
  reasoning?: string;
  isStreamingReasoning?: boolean;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  activeToolCalls?: ToolCallState[];
  isLatest?: boolean;
  /** Tool calls the SDK has blocked, waiting on the user. */
  pendingApprovals?: PendingApproval[];
  /** Called with the full batch once every pending call has a decision. */
  onApproveDecisions?: (decisions: ApprovalDecision[]) => void;
  /** Whether a decision batch is already in flight. */
  approvalsDisabled?: boolean;
}

/**
 * Displays a timeline of response processing steps: thinking (reasoning), tool calls, and results.
 * Renders each step in a collapsible format with streaming indicators.
 * Used in MessageBubble to show model reasoning and tool execution details.
 *
 * @param props.reasoning - Extended thinking/reasoning text from the model.
 * @param props.isStreamingReasoning - Whether reasoning is currently streaming.
 * @param props.toolCalls - Array of tools the model intends to call.
 * @param props.toolResults - Results returned from tool executions.
 * @param props.activeToolCalls - Real-time tool execution state during streaming.
 * @param props.isLatest - Whether this is the latest message (affects auto-expand behavior).
 * @param props.pendingApprovals - Tool calls blocked by the approval gate.
 * @param props.onApproveDecisions - Receives the full batch of decisions.
 * @param props.approvalsDisabled - Whether a decision batch is in flight.
 * @author Maruf Bepary
 */
export function ResponseTimeline({
  reasoning,
  isStreamingReasoning,
  toolCalls,
  toolResults,
  activeToolCalls,
  isLatest,
  pendingApprovals,
  onApproveDecisions,
  approvalsDisabled,
}: ResponseTimelineProps) {
  // Currently, we don't have true interleaving from the backend yet,
  // so we'll group them: Thinking first, then Tool Calls.
  // This structure allows us to easily add interleaved support later if the backend emits sequential steps.

  const steps = useMemo(() => {
    const items: React.ReactNode[] = [];
    let stepCount = 0;

    // 1. Thinking Step
    if (reasoning || isStreamingReasoning) {
      stepCount++;
      items.push(
        <ThinkingDisplay
          key="thinking"
          reasoning={reasoning ?? ""}
          isStreaming={isStreamingReasoning}
          initialOpen={isLatest && !!reasoning}
          stepNumber={stepCount}
        />,
      );
    }

    // 2. Tool Calls Step
    const hasActiveTools = activeToolCalls && activeToolCalls.length > 0;
    const hasStaticTools = toolCalls && toolCalls.length > 0;
    // A parked round stores the blocked call under pendingApprovals only, so
    // toolCalls is empty. Without this the approval row never renders, and the
    // user is permanently unable to unblock the gate.
    const hasPendingApprovals = pendingApprovals && pendingApprovals.length > 0;

    if (hasActiveTools || hasStaticTools || hasPendingApprovals) {
      if (hasActiveTools) {
        items.push(
          <ToolCallDisplay
            key="tools-active"
            toolCalls={activeToolCalls!.map((tc) => ({
              toolCallId: tc.toolCallId,
              toolName: tc.toolName,
              args: tc.args as any,
            }))}
            toolResults={activeToolCalls!
              .filter((tc) => tc.status === "complete")
              .map((tc) => ({
                toolCallId: tc.toolCallId,
                toolName: tc.toolName,
                result: tc.result,
              }))}
            initialOpen={false}
            pendingApprovals={pendingApprovals}
            onApproveDecisions={onApproveDecisions}
            approvalsDisabled={approvalsDisabled}
          />,
        );
      } else if (hasStaticTools || hasPendingApprovals) {
        // The static branch also covers a parked round: ToolCallDisplay merges
        // pendingApprovals into its row list, so an approval-only round gets a
        // row even though it has no toolCalls entries.
        items.push(
          <ToolCallDisplay
            key="tools-static"
            toolCalls={toolCalls ?? []}
            toolResults={toolResults ?? []}
            initialOpen={false}
            pendingApprovals={pendingApprovals}
            onApproveDecisions={onApproveDecisions}
            approvalsDisabled={approvalsDisabled}
          />,
        );
      }
    }

    return items;
  }, [
    reasoning,
    isStreamingReasoning,
    toolCalls,
    toolResults,
    activeToolCalls,
    isLatest,
    pendingApprovals,
    onApproveDecisions,
    approvalsDisabled,
  ]);

  if (steps.length === 0) return null;

  return <div className="space-y-2">{steps}</div>;
}
