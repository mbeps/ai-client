import type { ToolCall } from "@/types/chat/tool-call";
import type { ToolResult } from "@/types/chat/tool-result";
import type { ApprovalMode, PendingApproval } from "@/types/tool/approval";

/**
 * Token usage data from the AI model response.
 */
export type MessageUsage = {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
};

/**
 * Comprehensive metadata parsed from a message's JSON metadata field.
 * Extracts prompt shortcuts, tool invocations, model information, and reasoning in a single pass.
 * Designed to support tree-based message storage with rich context for branching and reconstruction.
 *
 * @typedef {Object} ParsedMessageMetadata
 * @property {Object | null} promptMeta - Prompt shortcut reference, if this message used a prompt template
 * @property {string} promptMeta.promptId - Identifier of the prompt template used
 * @property {string} promptMeta.userContent - User input content for the prompt
 * @property {Object | null} toolData - Tool invocation data, if this message involved tool calls
 * @property {ToolCall[]} toolData.toolCalls - Array of tool calls made during message generation
 * @property {ToolResult[]} toolData.toolResults - Array of tool results returned from execution
 * @property {string | null} modelId - Model identifier (provider + model name), if specified at message time
 * @property {string[] | null} selectedServerIds - Array of MCP server IDs active when message was created
 * @property {string[] | null} selectedTools - Array of tool names explicitly enabled by user
 * @property {string[] | null} selectedKbIds - Array of knowledge base IDs selected for RAG context
 * @property {string | undefined} reasoning - Extended reasoning/thinking output from the model, if available
 * @property {MessageUsage | null} usage - Token usage statistics from the model response
 * @property {string | null} finishReason - Why the model stopped generating (e.g. "stop", "length")
 * @property {number | null} durationMs - Wall-clock generation time in milliseconds
 * @property {PendingApproval[]} pendingApprovals - Tool calls blocked awaiting a user decision; empty once resolved
 * @property {number} approvalRound - How many approval rounds this message has already been through
 * @property {string | null} parentUserMessageId - Id of the user message this assistant turn answers; the resume path needs it to reload the thread without truncating the approval pair away
 * @property {ApprovalMode | null} approvalMode - Mode the turn was started under; the resume path needs it or it re-gates every tool
 *
 * @author Maruf Bepary
 */
export type ParsedMessageMetadata = {
  promptMeta: {
    promptId: string;
    promptIds: string[];
    userContent: string;
  } | null;
  toolData: { toolCalls: ToolCall[]; toolResults: ToolResult[] } | null;
  modelId: string | null;
  selectedServerIds: string[] | null;
  selectedTools: string[] | null;
  selectedKbIds: string[] | null;
  selectedSkillIds: string[] | null;
  reasoning: string | undefined;
  usage: MessageUsage | null;
  finishReason: string | null;
  durationMs: number | null;
  /** Tool calls blocked awaiting a user decision. Empty once resolved. */
  pendingApprovals: PendingApproval[];
  /** How many approval rounds this message has already been through. */
  approvalRound: number;
  /**
   * Mode the turn was started under. The resume path reads it so a round
   * resumed under auto-approve does not suddenly demand approval.
   */
  approvalMode: ApprovalMode | null;
  /**
   * Id of the user message this assistant turn answers. Needed by the resume
   * path, which reloads the thread up to that message and would otherwise
   * truncate the approval pair away.
   */
  parentUserMessageId: string | null;
};
