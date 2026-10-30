import type { ModelMessage } from "ai";
import { env } from "@/config/env";
import { assembleModelMessages } from "@/lib/chat/assemble-model-messages";
import { estimateTokens } from "@/lib/chat/estimate-tokens";
import type { ThreadMessage } from "@/lib/chat/load-thread-from-db";
import { getLogger } from "@/lib/logger";

const log = getLogger(["app", "chat", "messages"]);

/**
 * Represents message orchestration options.
 *
 * @author Maruf Bepary
 */
interface MessageOrchestrationOptions {
  history: ThreadMessage[];
  maxContextTokens?: number;
}

/**
 * Resolves token count for a tool payload (args, input, result, or output).
 *
 * @param payload - Tool data payload
 * @returns Estimated token count
 * @author Maruf Bepary
 */
function estimatePayloadTokens(payload: unknown): number {
  if (payload === undefined || payload === null) return 0;
  if (typeof payload === "string") return estimateTokens(payload);
  try {
    return estimateTokens(JSON.stringify(payload));
  } catch {
    return 0;
  }
}

/**
 * Resolves the underlying data value from a tool result message part.
 *
 * @param part - Message part containing output or result
 * @returns Extracted value payload
 * @author Maruf Bepary
 */
function resolveToolResultValue(part: Record<string, unknown>): unknown {
  const out = part.output !== undefined ? part.output : part.result;
  if (out && typeof out === "object" && "value" in out) {
    return (out as { value: unknown }).value;
  }
  return out;
}

/**
 * Estimates token consumption for an individual message part.
 *
 * Handles text, reasoning, image/file attachments, tool calls (args/input),
 * and tool results (output/result, unwrapping AI SDK v7 output.value).
 *
 * @param part - Message part within a multimodal content array
 * @returns Estimated tokens for the part
 * @author Maruf Bepary
 */
function estimateMessagePartTokens(part: unknown): number {
  if (!part) return 0;
  if (typeof part === "string") return estimateTokens(part);
  if (typeof part !== "object") return 0;

  const p = part as Record<string, unknown>;

  if (typeof p.text === "string") {
    return estimateTokens(p.text);
  }
  if (p.type === "file" || p.type === "image") {
    return 800;
  }
  if (typeof p.reasoning === "string") {
    return estimateTokens(p.reasoning);
  }
  if ("input" in p || "args" in p) {
    return estimatePayloadTokens(p.input !== undefined ? p.input : p.args);
  }
  if ("output" in p || "result" in p) {
    return estimatePayloadTokens(resolveToolResultValue(p));
  }

  return 0;
}

/**
 * Estimates tokens for an assembled ModelMessage.
 *
 * @param m - Target ModelMessage
 * @returns Estimated token count
 * @author Maruf Bepary
 */
export function estimateModelMessageTokens(m: ModelMessage): number {
  if (typeof m.content === "string") {
    return estimateTokens(m.content);
  }
  if (Array.isArray(m.content)) {
    return m.content.reduce(
      (sum, part) => sum + estimateMessagePartTokens(part),
      0,
    );
  }
  return 0;
}

/**
 * Drops leading non-user messages from the messages array so conversation begins with user input.
 *
 * @param messages - Model messages to inspect
 * @returns Sliced array starting with a user message
 * @author Maruf Bepary
 */
function trimLeadingNonUsers(messages: ModelMessage[]): ModelMessage[] {
  let startIdx = 0;
  while (startIdx < messages.length && messages[startIdx].role !== "user") {
    startIdx++;
  }
  return startIdx > 0 ? messages.slice(startIdx) : messages;
}

/**
 * Trims conversation history from the oldest turns forward until total tokens fall within budget.
 *
 * @param messages - Messages to trim
 * @param maxContextTokens - Token budget
 * @returns Messages within token budget
 * @author Maruf Bepary
 */
function trimToTokenBudget(
  messages: ModelMessage[],
  maxContextTokens: number,
): ModelMessage[] {
  let currentMessages = messages;
  let currentTokens = currentMessages.reduce(
    (sum, m) => sum + estimateModelMessageTokens(m),
    0,
  );

  while (currentTokens > maxContextTokens) {
    const nextUserIdx = currentMessages.findIndex(
      (m, idx) => idx > 0 && m.role === "user",
    );
    if (nextUserIdx === -1) break;

    currentMessages = currentMessages.slice(nextUserIdx);
    currentTokens = currentMessages.reduce(
      (sum, m) => sum + estimateModelMessageTokens(m),
      0,
    );
  }

  if (currentMessages.length < messages.length) {
    log.warn(
      "Chat history budget-trimmed from {originalCount} to {keptCount} turns for context budget {maxContextTokens}",
      {
        originalCount: messages.length,
        keptCount: currentMessages.length,
        maxContextTokens,
      },
    );
  }

  return currentMessages;
}

/**
 * Orchestrates the final set of messages to be sent to the AI model. Converts the thread history into model messages and truncates to the most recent `env.CHAT_MAX_HISTORY_TURNS` entries (the last message is always kept, with a warning logged on truncation). The system prompt is NOT included here — the route passes it separately via `streamText({ system })`.
 *
 * @param options - Target options
 * @returns The resolved result
 * @author Maruf Bepary
 */
export function prepareChatMessages(
  options: MessageOrchestrationOptions,
): ModelMessage[] {
  const { history, maxContextTokens } = options;

  const processedMessages = assembleModelMessages(history);

  const limit = Math.max(1, env.CHAT_MAX_HISTORY_TURNS);
  const isTruncated = processedMessages.length > limit;
  const initialSlice = isTruncated
    ? processedMessages.slice(-limit)
    : processedMessages;

  let finalMessages = trimLeadingNonUsers(initialSlice);

  if (isTruncated) {
    log.warn(
      "Chat history truncated from {originalCount} to {keptCount} turns",
      {
        originalCount: processedMessages.length,
        keptCount: finalMessages.length,
      },
    );
  }

  if (maxContextTokens !== undefined && maxContextTokens > 0) {
    finalMessages = trimToTokenBudget(finalMessages, maxContextTokens);
  }

  return finalMessages;
}
