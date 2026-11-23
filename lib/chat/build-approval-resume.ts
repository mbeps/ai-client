import type { AssistantModelMessage, ModelMessage, ToolModelMessage } from "ai";
import type { ApprovalDecision, PendingApproval } from "@/types/tool/approval";

/**
 * Builds the `[assistantMessage, toolMessage]` pair required by AI SDK v7 to
 * resume a paused `streamText` turn after the user answers pending tool
 * approval requests.
 *
 * Iterates strictly in `pending` emission order so out-of-order client
 * decision arrays cannot reorder dependent tool executions.
 *
 * @param pending - Persisted pending approval requests in emission order.
 * @param decisions - User approval decisions for every pending request.
 * @returns Two-element `ModelMessage[]` pair, or `[]` when `pending` is empty.
 * @throws Error if any pending approval lacks a corresponding decision.
 */
export function buildApprovalResumeMessages(
  pending: readonly PendingApproval[],
  decisions: readonly ApprovalDecision[],
): ModelMessage[] {
  if (pending.length === 0) {
    return [];
  }

  const decisionMap = new Map<string, boolean>();
  for (const decision of decisions) {
    decisionMap.set(decision.approvalId, decision.approved);
  }

  const assistantContent: Exclude<AssistantModelMessage["content"], string> =
    [];
  const toolContent: ToolModelMessage["content"] = [];

  for (const approval of pending) {
    const approved = decisionMap.get(approval.approvalId);
    if (approved === undefined) {
      throw new Error(`Missing approval decision for ${approval.approvalId}`);
    }

    assistantContent.push({
      type: "tool-call",
      toolCallId: approval.toolCallId,
      toolName: approval.toolName,
      input: approval.args ?? {},
    });

    assistantContent.push({
      type: "tool-approval-request",
      approvalId: approval.approvalId,
      toolCallId: approval.toolCallId,
      ...(approval.reason !== undefined ? { reason: approval.reason } : {}),
      signature: approval.signature,
    });

    toolContent.push({
      type: "tool-approval-response",
      approvalId: approval.approvalId,
      approved,
    });
  }

  const assistantMessage: AssistantModelMessage = {
    role: "assistant",
    content: assistantContent,
  };

  const toolMessage: ToolModelMessage = {
    role: "tool",
    content: toolContent,
  };

  return [assistantMessage, toolMessage];
}
