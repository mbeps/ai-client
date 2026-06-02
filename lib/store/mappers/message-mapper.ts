import { z } from "zod";
import { persistMessageSchema } from "@/schemas/chat";
import type { Message } from "@/types/message";
import type { Attachment } from "@/types/attachment";

export type ToolCall = {
  toolCallId: string;
  toolName: string;
  args: unknown;
  serverName?: string;
};

export type ToolResult = {
  toolCallId: string;
  toolName: string;
  result: unknown;
  serverName?: string;
};

export type Citation = {
  content: string;
  relevanceScore: number;
  documentId: string;
  documentName: string;
  s3Key: string;
};

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
 * Parses message metadata JSON once and extracts all concerns
 * (prompt shortcut info, tool calls, model identifier, and reasoning) in a single pass.
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
    console.error("[MessageMapper] Metadata parse error:", e);
    return empty;
  }
}

/**
 * Extracts RAG citations from tool results.
 * Identifies "search_knowledge_base" tool outputs and formats them.
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
 * Maps a message row from the database (including attachments) to a store-compatible Message object.
 */
export function mapMessageFromDb(
  m: z.infer<typeof persistMessageSchema> & {
    createdAt: Date | string | null;
    chatId: string;
  },
  attachments: Attachment[] = [],
): Message {
  const { reasoning } = parseMessageMetadata(m.metadata);

  return {
    id: m.id,
    role: m.role as "user" | "assistant",
    content: m.content,
    createdAt:
      m.createdAt instanceof Date
        ? m.createdAt
        : new Date(m.createdAt || Date.now()),
    parentId: m.parentId,
    childrenIds: [], // Populated during tree reconstruction
    metadata: m.metadata || null,
    reasoning,
    attachments,
  };
}
