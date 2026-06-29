import { z } from "zod";
import { persistMessageSchema } from "@/schemas/chat/chat";
import type { Message } from "@/types/message/message";
import type { Attachment } from "@/types/attachment/attachment";
import { logger } from "@/lib/logger";

/**
 * Represents a single AI tool invocation within a message context.
 * Used to track MCP server tools and their arguments during message execution.
 *
 * @typedef {Object} ToolCall
 * @property {string} toolCallId - Unique identifier for this specific tool invocation, used to match results
 * @property {string} toolName - Name of the tool being called (e.g., "search_knowledge_base", "create_file")
 * @property {unknown} args - Serialized arguments passed to the tool; structure depends on tool implementation
 * @property {string} [serverName] - Optional MCP server name that hosts this tool (e.g., "mcp-filesystem", "mcp-memory")
 */
export type ToolCall = {
  toolCallId: string;
  toolName: string;
  args: unknown;
  serverName?: string;
};

/**
 * Represents the result of a tool execution within a message context.
 * Contains output and metadata needed to extract citations, side effects, or further processing.
 *
 * @typedef {Object} ToolResult
 * @property {string} toolCallId - Matches the `toolCallId` from the corresponding `ToolCall`
 * @property {string} toolName - Name of the tool that was executed
 * @property {unknown} result - Serialized output from the tool; may include nested data like search results
 * @property {string} [serverName] - Optional MCP server name for audit/debugging purposes
 * @see {@link extractCitations} for extraction of RAG citations from search_knowledge_base results
 */
export type ToolResult = {
  toolCallId: string;
  toolName: string;
  result: unknown;
  serverName?: string;
};

/**
 * Represents a single knowledge base document citation extracted from RAG search results.
 * Used to attribute content sources and provide relevance scoring in message rendering.
 *
 * @typedef {Object} Citation
 * @property {string} content - Text excerpt from the document that was retrieved
 * @property {number} relevanceScore - Semantic similarity score (0-1 range), higher = more relevant
 * @property {string} documentId - Unique identifier of the document in the knowledge base
 * @property {string} documentName - Human-readable name of the document for display
 * @property {string} s3Key - S3 object key for storage/retrieval of the original document file
 */
export type Citation = {
  content: string;
  relevanceScore: number;
  documentId: string;
  documentName: string;
  s3Key: string;
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

/**
 * Parses message metadata JSON with sensible defaults for missing/malformed data.
 *
 * @param {string | null | undefined} metadata - Raw JSON string from database or null
 * @returns {ParsedMessageMetadata} Typed metadata object; never throws
 * @author Maruf Bepary
 */
export function parseMessageMetadata(
  metadata: string | null | undefined,
): ParsedMessageMetadata {
  const empty: ParsedMessageMetadata = {
    promptMeta: null,
    toolData: null,
    modelId: null,
    selectedServerIds: null,
    selectedTools: null,
    selectedKbIds: null,
    reasoning: undefined,
  };

  if (!metadata) return empty;

  try {
    const parsed =
      typeof metadata === "string" ? JSON.parse(metadata) : metadata;

    const promptMeta =
      typeof parsed.promptId === "string" &&
      typeof parsed.userContent === "string"
        ? {
            promptId: parsed.promptId,
            userContent: parsed.userContent,
          }
        : null;

    const toolData =
      Array.isArray(parsed.toolCalls) && parsed.toolCalls.length > 0
        ? {
            toolCalls: parsed.toolCalls as ToolCall[],
            toolResults: Array.isArray(parsed.toolResults)
              ? (parsed.toolResults as ToolResult[])
              : [],
          }
        : null;

    const modelId = typeof parsed.model === "string" ? parsed.model : null;

    const selectedServerIds = Array.isArray(parsed.selectedServerIds)
      ? (parsed.selectedServerIds as string[])
      : null;

    const selectedTools = Array.isArray(parsed.selectedTools)
      ? (parsed.selectedTools as string[])
      : null;

    const selectedKbIds = Array.isArray(parsed.selectedKbIds)
      ? (parsed.selectedKbIds as string[])
      : null;

    const reasoning =
      typeof parsed.reasoning === "string" ? parsed.reasoning : undefined;

    return {
      promptMeta,
      toolData,
      modelId,
      selectedServerIds,
      selectedTools,
      selectedKbIds,
      reasoning,
    };
  } catch (e) {
    logger.error("[MessageMapper] Metadata parse error:", e);
    return empty;
  }
}

/**
 * Extracts RAG citations from tool results by identifying search_knowledge_base outputs.
 * Flattens citations from all matching tool results into a single array for message rendering.
 * Used to display document sources and relevance scores to the user.
 *
 * @param {ToolResult[]} toolResults - Array of tool execution results from message metadata
 * @returns {Citation[]} Array of extracted citations; empty array if no search results found
 * @see {@link Citation} for citation type structure
 * @see {@link parseMessageMetadata} which provides the toolResults input
 * @author Maruf Bepary
 */
export function extractCitations(toolResults: ToolResult[]): Citation[] {
  const citations: Citation[] = [];

  for (const tr of toolResults) {
    if (tr.toolName === "search_knowledge_base") {
      const data = tr.result as { results?: Citation[] };
      if (Array.isArray(data?.results)) {
        citations.push(...data.results);
      }
    }
  }

  return citations;
}

/**
 * Maps a message row from the database to a store-compatible Message object.
 * Reconstructs the tree-based message structure by parsing metadata and associating attachments.
 * Children IDs are populated during subsequent tree reconstruction pass.
 *
 * @param {Object} m - Message row from database, includes schema fields plus createdAt and chatId
 * @param {string} m.id - Message identifier
 * @param {string} m.role - Message role ("user" | "assistant" | "system")
 * @param {string} m.content - Message text content
 * @param {Date} m.createdAt - Message creation timestamp
 * @param {string} m.parentId - Parent message ID for tree linking (null for root messages)
 * @param {string | null} m.metadata - JSON metadata containing prompt, tools, model, reasoning
 * @param {string} m.chatId - Associated chat ID
 * @param {Attachment[]} [attachments=[]] - Array of file attachments for this message
 * @returns {Message} Fully mapped Message object with reasoning extracted, ready for store hydration
 * @see {@link parseMessageMetadata} which extracts the reasoning field
 * @see {@link extractCitations} for extracting sources from message metadata
 * @author Maruf Bepary
 */
export function mapMessageFromDb(
  m: z.infer<typeof persistMessageSchema> & {
    createdAt: Date;
    chatId: string;
  },
  attachments: Attachment[] = [],
): Message {
  const { reasoning } = parseMessageMetadata(m.metadata);

  return {
    id: m.id,
    role: m.role as Message["role"],
    content: m.content,
    createdAt: m.createdAt,
    parentId: m.parentId,
    childrenIds: [], // Populated during tree reconstruction
    metadata: m.metadata || null,
    reasoning,
    attachments,
  };
}
