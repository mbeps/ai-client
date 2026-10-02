/**
 * Whether tool calls pause for the user before executing.
 * "ask" is the default and the safe value; "auto" runs everything immediately.
 *
 * @author Maruf Bepary
 */
export type ApprovalMode = "ask" | "auto";

/**
 * A tool call that is blocked awaiting a user decision, exactly as the AI SDK
 * emitted it. Persisted so the gate survives a page refresh and the loss of
 * the Inngest run that produced it.
 *
 * @author Maruf Bepary
 */
export interface PendingApproval {
  /**
   * Runtime id the AI SDK generated for this approval. Never recompute it.
   * The SDK regenerates it on every resume, so the value shown to the user is
   * the only one that will ever match.
   */
  approvalId: string;

  /** Provider-assigned id of the blocked tool call. */
  toolCallId: string;

  /** Registered tool name. */
  toolName: string;

  /** MCP server the tool came from, when it is not an internal tool. */
  serverName?: string;

  /** Parsed tool input. Must stay an object; the SDK rejects a JSON string. */
  args: unknown;

  /** Why the SDK asked, when it supplied a reason. */
  reason?: string;

  /** HMAC binding this approval to its tool call. Required to approve. */
  signature: string;
}

/**
 * The only thing the client is permitted to decide. Everything else about an
 * approval is read back from the database on the server.
 *
 * @author Maruf Bepary
 */
export interface ApprovalDecision {
  /** Must match the stored approval exactly or the SDK rejects the response. */
  approvalId: string;

  /** True approves and runs the tool; false denies and skips execution. */
  approved: boolean;
}
