import { type ModelMessage } from "ai";
import { env } from "@/lib/env";
import { logger } from "@/lib/logger";
import { assembleModelMessages } from "@/lib/chat/assemble-model-messages";
import { type ThreadMessage } from "@/lib/chat/load-thread-from-db";

interface MessageOrchestrationOptions {
  history: ThreadMessage[];
  kbIsReady?: boolean;
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
  const { history, kbIsReady } = options;

  // kbIsReady is accepted for call-site symmetry with the route's context —
  // the KB instruction now lives in the system prompt (buildSystemPrompt).
  void kbIsReady;

  const processedMessages = assembleModelMessages(history);

  // ponytail: "turns" == assembled model messages; a token-weighted budget would
  // be smarter. Upgrade path: tokenizer-based trimming per provider.
  const limit = Math.max(1, env.CHAT_MAX_HISTORY_TURNS);
  let finalMessages = processedMessages;
  if (processedMessages.length > limit) {
    finalMessages = processedMessages.slice(-limit);
    logger.warn("[Chat API] History truncated", {
      originalCount: processedMessages.length,
      keptCount: limit,
    });
  }

  return finalMessages;
}
