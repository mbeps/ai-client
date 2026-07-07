import { type ModelMessage } from "ai";
import { type ChatMessage } from "@/schemas/chat/chat";
import { assembleModelMessages } from "@/lib/chat/assemble-model-messages";
import { buildSystemPrompt } from "@/lib/chat/build-system-prompt";

interface MessageOrchestrationOptions {
  history: ChatMessage[];
  globalSystemPrompt?: string | null;
  projectPrompt?: string | null;
  assistantPrompt?: string | null;
  kbIsReady?: boolean;
  attachmentUrls?: { name: string; url: string }[];
}

/**
 * Orchestrates the final set of messages to be sent to the AI model.
 * Combines system prompts (global, project, assistant, KB) and processed history.
 */
export function prepareChatMessages(
  options: MessageOrchestrationOptions,
): ModelMessage[] {
  const {
    history,
    globalSystemPrompt,
    projectPrompt,
    assistantPrompt,
    kbIsReady,
    attachmentUrls,
  } = options;

  const processedMessages = assembleModelMessages(history);

  const systemMessages = buildSystemPrompt(
    globalSystemPrompt,
    projectPrompt,
    assistantPrompt,
    !!kbIsReady,
    attachmentUrls,
  );

  const finalMessages: ModelMessage[] = [
    ...systemMessages,
    ...processedMessages,
  ];

  if (finalMessages.length === 0) {
    finalMessages.push({
      role: "system",
      content: "You are a helpful AI assistant.",
    });
  }

  return finalMessages;
}
