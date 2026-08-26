import { type ModelMessage } from "ai";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { assembleModelMessages } from "@/lib/chat/assemble-model-messages";
import { type ThreadMessage } from "@/lib/chat/load-thread-from-db";

interface MessageOrchestrationOptions {
  history: ThreadMessage[];
}

/**
 * Orchestrates the final set of messages to be sent to the AI model.
 * Converts the thread history into model messages and truncates to the most
 * recent `env.CHAT_MAX_HISTORY_TURNS` entries (the last message is always
 * kept, with a warning logged on truncation). The system prompt is NOT
 * included here — the route passes it separately via `streamText({ system })`.
 */
export function prepareChatMessages(
  options: MessageOrchestrationOptions,
): ModelMessage[] {
  const { history } = options;

  const processedMessages = assembleModelMessages(history);

  // ponytail: "turns" == assembled model messages; a token-weighted budget would
  // be smarter. Upgrade path: tokenizer-based trimming per provider.
  const limit = Math.max(1, env.CHAT_MAX_HISTORY_TURNS);
  let finalMessages = processedMessages;
  if (processedMessages.length > limit) {
    finalMessages = processedMessages.slice(-limit);
    // A flat slice can land between an assistant tool-call message and its
    // trailing role:"tool" result — providers reject orphaned results (400).
    // Invariant: a tool result always immediately follows its call, so dropping
    // leading orphan tool messages is sufficient to keep pairs intact.
    while (finalMessages.length > 0 && finalMessages[0].role === "tool") {
      finalMessages = finalMessages.slice(1);
    }
    logger.warn("[Chat API] History truncated", {
      originalCount: processedMessages.length,
      keptCount: limit,
    });
  }

  return finalMessages;
}
