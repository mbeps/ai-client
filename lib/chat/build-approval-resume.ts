import type {
  ModelMessage,
  ToolApprovalRequest,
  ToolApprovalResponse,
  ToolCallPart,
} from "ai";
import type { ApprovalDecision, PendingApproval } from "@/types/tool/approval";

/**
 * Builds the two messages that answer a paused round of tool calls.
 *
 * The AI SDK matches a response to its request by `approvalId` and refuses to
 * resume a round it has only partly answered, throwing
 * `MissingToolResultsError` and killing the turn. This function therefore
 * refuses a partial decision set rather than emitting it.
 *
 * The assistant message iterates the pending list so the request order matches
 * the order the SDK emitted, while the tool message iterates the decisions so
 * the SDK executes them in the order the user answered (V8).
 *
 * @param pending - Approvals exactly as persisted, in emission order.
 * @param decisions - Approve or deny per `approvalId`. Order is preserved.
 * @returns Two messages to append, or an empty array when nothing is pending.
 * @throws Error when any pending call has no matching decision.
 * @author Maruf Bepary
 */
export function buildApprovalResumeMessages(
  pending: readonly PendingApproval[],
  decisions: readonly ApprovalDecision[],
): ModelMessage[] {
  if (pending.length === 0) return [];

  const verdicts = new Map(
    decisions.map((d) => [d.approvalId, d.approved === true] as const),
  );

  const unanswered = pending.filter((p) => !verdicts.has(p.approvalId));
  if (unanswered.length > 0) {
    throw new Error(
      "All pending tool calls must be answered together. Missing: " +
        unanswered.map((p) => p.approvalId).join(", "),
    );
  }

  const assistantContent: Array<ToolCallPart | ToolApprovalRequest> = [];
  const toolContent: ToolApprovalResponse[] = [];

  for (const approval of pending) {
    assistantContent.push({
      type: "tool-call",
      toolCallId: approval.toolCallId,
      toolName: approval.toolName,
      input: approval.args,
    });
    assistantContent.push({
      type: "tool-approval-request",
      approvalId: approval.approvalId,
      toolCallId: approval.toolCallId,
      reason: approval.reason,
      signature: approval.signature,
    });
  }

  for (const decision of decisions) {
    if (!pending.some((p) => p.approvalId === decision.approvalId)) continue;
    toolContent.push({
      type: "tool-approval-response",
      approvalId: decision.approvalId,
      approved: verdicts.get(decision.approvalId) === true,
    });
  }

  return [
    { role: "assistant", content: assistantContent },
    { role: "tool", content: toolContent },
  ];
}
