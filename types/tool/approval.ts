/**
 * Execution permission mode for a chat session or individual tool.
 *
 * - `"ask"`: Requires explicit user approval before executing gated tools.
 * - `"auto"`: Automatically approves tool calls without prompting.
 */
export type ApprovalMode = "ask" | "auto";

/**
 * AI SDK v7 `toolApproval` map entry values produced by policy resolution.
 */
export type ToolApprovalStatusValue = "not-applicable" | "user-approval";

/**
 * Per-tool approval map passed to AI SDK `streamText` / `ToolLoopAgent`.
 */
export type ToolApprovalMap = Record<string, ToolApprovalStatusValue>;

/**
 * Persisted and streamed representation of a single blocked tool call waiting
 * for user approval.
 */
export interface PendingApproval {
  approvalId: string;
  toolCallId: string;
  toolName: string;
  serverName?: string;
  serverId?: string;
  subagentId?: string;
  subagentName?: string;
  args: unknown;
  reason?: string;
  signature: string;
}

/**
 * User verdict for a single pending tool approval request.
 */
export interface ApprovalDecision {
  approvalId: string;
  approved: boolean;
}
