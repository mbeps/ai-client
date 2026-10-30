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
  let finalMessages = processedMessages;
  if (processedMessages.length > limit) {
    finalMessages = processedMessages.slice(-limit);
    while (finalMessages.length > 0 && finalMessages[0].role !== "user") {
      finalMessages.shift();
    }
    log.warn(
      "Chat history truncated from {originalCount} to {keptCount} turns",
      {
        originalCount: processedMessages.length,
        keptCount: finalMessages.length,
      },
    );
  } else {
    while (finalMessages.length > 0 && finalMessages[0].role !== "user") {
      finalMessages.shift();
    }
  }

  if (maxContextTokens !== undefined && maxContextTokens > 0) {
    let currentTokens = finalMessages.reduce(
      (sum, m) => sum + estimateModelMessageTokens(m),
      0,
    );

    const countBeforeTrimming = finalMessages.length;
    while (currentTokens > maxContextTokens) {
      const nextUserIdx = finalMessages.findIndex(
        (m, idx) => idx > 0 && m.role === "user",
      );
      if (nextUserIdx === -1) {
        break;
      }

      finalMessages = finalMessages.slice(nextUserIdx);
      currentTokens = finalMessages.reduce(
        (sum, m) => sum + estimateModelMessageTokens(m),
        0,
      );
    }

    if (finalMessages.length < countBeforeTrimming) {
      log.warn(
        "Chat history budget-trimmed from {originalCount} to {keptCount} turns for context budget {maxContextTokens}",
        {
          originalCount: countBeforeTrimming,
          keptCount: finalMessages.length,
          maxContextTokens,
        },
      );
    }
  }

  return finalMessages;
}
