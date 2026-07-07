import { ToolCall } from "@/types/chat/tool-call";
import { ToolResult } from "@/types/chat/tool-result";

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
 *
 * @author Maruf Bepary
 */
export type ParsedMessageMetadata = {
  promptMeta: { promptId: string; userContent: string } | null;
  toolData: { toolCalls: ToolCall[]; toolResults: ToolResult[] } | null;
  modelId: string | null;
  selectedServerIds: string[] | null;
  selectedTools: string[] | null;
  selectedKbIds: string[] | null;
  reasoning: string | undefined;
};
