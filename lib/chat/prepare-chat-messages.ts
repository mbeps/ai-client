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
    let tokens = 0;
    for (const part of m.content) {
      if (typeof part === "string") {
        tokens += estimateTokens(part);
      } else if ("text" in part && typeof part.text === "string") {
        tokens += estimateTokens(part.text);
      } else if (part.type === "file" || part.type === "image") {
        tokens += 800;
      } else if ("args" in part) {
        tokens += estimateTokens(
          typeof part.args === "string" ? part.args : JSON.stringify(part.args),
        );
      } else if ("result" in part) {
        tokens += estimateTokens(
          typeof part.result === "string"
            ? part.result
            : JSON.stringify(part.result),
        );
      }
    }
    return tokens;
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
