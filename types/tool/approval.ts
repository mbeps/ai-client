/**
 * Execution permission mode for a chat session.
 *
 * - `"ask"`: Requires explicit user approval before executing gated tools.
 * - `"auto"`: Automatically approves non-blocked tool calls without prompting.
 */
export type ApprovalMode = "ask" | "auto";

/**
 * Persistent per-tool permission policy for internal and MCP tools.
 *
 * - `"ask"`: Requires explicit user approval before executing.
 * - `"auto"`: Automatically approves tool calls without prompting.
 * - `"block"`: Blocks the tool from being exposed to or executed by models.
 */
export type ToolPermissionMode = ApprovalMode | "block";

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
