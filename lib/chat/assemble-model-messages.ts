import type { ModelMessage } from "ai";
import { getLogger } from "@/lib/logger";
import { sanitizeSubagentOutput } from "@/lib/subagents/subagent-dispatch-tool";

const log = getLogger(["app", "chat", "messages"]);

/**
 * Text content part for Vercel AI SDK model messages.
 * @author Maruf Bepary
 */
type TextPart = { type: "text"; text: string };

/**
 * File content part for Vercel AI SDK v7 model messages.
 * @author Maruf Bepary
 */
type FilePart = {
  type: "file";
  data: { type: "url"; url: string };
  mediaType: string;
};

/**
 * Chat message from the request, including attachments and metadata.
 * Includes extracted text from documents and data URLs for images.
 * @author Maruf Bepary
 */
type HistoryMessage = {
  role: string;
  content:
    | string
    | Array<{ type: string; text?: string; image?: string; mimeType?: string }>;
  attachments?: Array<{
    id: string;
    type?: string;
    url?: string;
    name: string;
    mimeType?: string;
    extractedText?: string | null;
    key?: string;
  }>;
  metadata?: string | null;
};

const LARGE_OUTPUT_NOTICE =
  "\n\n[... Large tool output truncated for context window limits ...]";

/**
 * Builds text parts for document and non-image file attachments.
 */
function buildDocumentAndFileParts(
  attachments: NonNullable<HistoryMessage["attachments"]>,
): TextPart[] {
  const parts: TextPart[] = [];
  for (const att of attachments) {
    if (att.type === "document" && att.extractedText) {
      parts.push({
        type: "text",
        text: `[Document: ${att.name}]\n${att.extractedText}`,
      });
    } else if (att.type !== "image") {
      parts.push({
        type: "text",
        text: `[Attached File: ${att.name} (${att.type})]`,
      });
    }
  }
  return parts;
}

/**
 * Builds image file parts with presigned URLs.
 */
function buildImageParts(
  attachments: NonNullable<HistoryMessage["attachments"]>,
): FilePart[] {
  const parts: FilePart[] = [];
  for (const att of attachments) {
    if (att.type === "image" && att.url) {
      parts.push({
        type: "file",
        data: { type: "url", url: att.url },
        mediaType: att.mimeType ?? "image",
      });
    }
  }
  return parts;
}

/**
 * Assembles a user message containing attachments into a ModelMessage.
 */
function assembleUserMessageWithAttachments(m: HistoryMessage): ModelMessage {
  const attachments = m.attachments ?? [];
  const docParts = buildDocumentAndFileParts(attachments);
  const textParts: TextPart[] =
    typeof m.content === "string" && m.content.trim()
      ? [{ type: "text", text: m.content }]
      : [];
  const imageParts = buildImageParts(attachments);
  const parts = [...docParts, ...textParts, ...imageParts];

  return {
    role: m.role,
    content:
      parts.length === 1 && parts[0].type === "text"
        ? (parts[0] as TextPart).text
        : parts,
  } as ModelMessage;
}

/**
 * Normalizes tool call args/input from string or object.
 */
function parseToolCallInput(tc: any): unknown {
  let parsedInput = tc.args ?? tc.input;
  if (typeof parsedInput === "string") {
    try {
      parsedInput = JSON.parse(parsedInput);
    } catch {
      // Keep raw string if parsing fails
    }
  }
  return parsedInput;
}

/**
 * Parses raw tool output into value and JSON flag.
 */
function parseRawOutput(raw: unknown): {
  outputValue: unknown;
  isJson: boolean;
} {
  if (typeof raw === "object" && raw !== null) {
    return { outputValue: raw, isJson: true };
  }
  if (typeof raw === "string") {
    try {
      return { outputValue: JSON.parse(raw), isJson: true };
    } catch {
      return { outputValue: raw, isJson: false };
    }
  }
  return { outputValue: raw, isJson: false };
}

/**
 * Truncates oversized tool result outputs to protect context window.
 */
function truncateLargeOutput(
  outputValue: unknown,
  isJson: boolean,
  raw: unknown,
): string | null {
  if (isJson) {
    const strVal = JSON.stringify(outputValue);
    if (strVal.length > 12000) {
      return strVal.slice(0, 8000) + LARGE_OUTPUT_NOTICE;
    }
    return null;
  }
  if (typeof raw === "string" && raw.length > 8000) {
    return raw.slice(0, 8000) + LARGE_OUTPUT_NOTICE;
  }
  return null;
}

/**
 * Formats a generic tool result payload with size limits and JSON/text handling.
 */
function formatGenericToolResult(tc: any, raw: unknown): any {
  const { outputValue, isJson } = parseRawOutput(raw);
  const truncatedText = truncateLargeOutput(outputValue, isJson, raw);

  if (truncatedText !== null) {
    return {
      type: "tool-result",
      toolCallId: tc.toolCallId,
      toolName: tc.toolName,
      output: { type: "text", value: truncatedText },
    };
  }

  return {
    type: "tool-result",
    toolCallId: tc.toolCallId,
    toolName: tc.toolName,
    output: isJson
      ? { type: "json", value: outputValue }
      : { type: "text", value: String(raw ?? "") },
  };
}

/**
 * Resolves raw result value from toolResult object.
 */
function resolveRawToolResult(tr: any): unknown {
  if (!tr) return { error: "Tool execution did not return a result" };
  if (tr.result !== undefined) return tr.result;
  if (tr.output !== undefined) return tr.output;
  return { error: "Tool execution did not return a result" };
}

/**
 * Formats subagent delegation tool output.
 */
function formatSubagentResult(tc: any, raw: unknown): any {
  const summary = sanitizeSubagentOutput(raw, 8000);
  return {
    type: "tool-result",
    toolCallId: tc.toolCallId,
    toolName: tc.toolName,
    output: { type: "text", value: summary },
  };
}

/**
 * Formats manage_artifact tool output.
 */
function formatArtifactResult(tc: any, raw: unknown): any {
  const art = (raw as any)?.artifact;
  const title = art?.title || "Artifact";
  const type = art?.type || "document";
  return {
    type: "tool-result",
    toolCallId: tc.toolCallId,
    toolName: tc.toolName,
    output: {
      type: "text",
      value: `Artifact "${title}" (${type}) created successfully and presented on canvas.`,
    },
  };
}

/**
 * Formats an individual tool result part for a given tool call.
 */
function formatToolResultPart(tc: any, toolResultsList: any[]): any {
  const tr = toolResultsList.find((r: any) => r.toolCallId === tc.toolCallId);
  const raw = resolveRawToolResult(tr);

  if (tc.toolName === "delegate_task" || tc.toolName === "subagent_dispatch") {
    return formatSubagentResult(tc, raw);
  }

  if (tc.toolName === "manage_artifact") {
    return formatArtifactResult(tc, raw);
  }

  return formatGenericToolResult(tc, raw);
}

/**
 * Builds optional text part for assistant message content.
 */
function buildAssistantTextPart(content: unknown): TextPart | null {
  if (typeof content === "string" && content.trim()) {
    return { type: "text", text: content };
  }
  return null;
}

/**
 * Builds tool call parts for assistant message.
 */
function buildAssistantToolCallParts(toolCalls: any[]): any[] {
  const parts: any[] = [];
  for (const tc of toolCalls) {
    const parsedInput = parseToolCallInput(tc);
    parts.push({
      type: "tool-call",
      toolCallId: tc.toolCallId,
      toolName: tc.toolName,
      input: parsedInput,
      args: parsedInput,
    });
  }
  return parts;
}

/**
 * Reconstructs assistant tool calls and corresponding tool response messages from metadata.
 */
function assembleAssistantToolMessages(
  m: HistoryMessage,
): ModelMessage[] | null {
  if (m.role !== "assistant" || !m.metadata) {
    return null;
  }

  try {
    const meta = JSON.parse(m.metadata);
    if (!Array.isArray(meta.toolCalls) || meta.toolCalls.length === 0) {
      return null;
    }

    const textPart = buildAssistantTextPart(m.content);
    const callParts = buildAssistantToolCallParts(meta.toolCalls);
    const content = textPart ? [textPart, ...callParts] : callParts;

    const toolResultsList = Array.isArray(meta.toolResults)
      ? meta.toolResults
      : [];
    const resultParts = meta.toolCalls.map((tc: any) =>
      formatToolResultPart(tc, toolResultsList),
    );

    return [
      { role: "assistant", content } as ModelMessage,
      { role: "tool", content: resultParts } as ModelMessage,
    ];
  } catch (e) {
    log.warn("Failed to parse metadata for history: {error}", {
      error: e instanceof Error ? e.message : String(e),
    });
    return null;
  }
}

/**
 * Converts raw chat history into Vercel AI SDK-compatible model messages.
 * Handles complex multimodal content assembly:
 * - Document attachments are converted to text parts with labels
 * - Images are placed after text to maintain token efficiency
 * - Assistant messages with tool calls are reconstructed with proper structure
 * - Tool results are attached as tool-role messages for proper model consumption
 *
 * @param messages - Raw history from chat request
 * @returns Messages formatted for Vercel AI SDK (text, images, tool calls, tool results)
 * @author Maruf Bepary
 */
export function assembleModelMessages(
  messages: HistoryMessage[],
): ModelMessage[] {
  return messages.flatMap((m) => {
    // In AI SDK v7, system instructions are supplied via `instructions:` option.
    // Explicit system messages in `messages[]` trigger InvalidPromptError.
    if (m.role === "system") {
      return [];
    }

    if (m.role === "user" && m.attachments && m.attachments.length > 0) {
      return [assembleUserMessageWithAttachments(m)];
    }

    const assistantToolMsgs = assembleAssistantToolMessages(m);
    if (assistantToolMsgs) {
      return assistantToolMsgs;
    }

    return [{ role: m.role as any, content: m.content as any }];
  });
}
