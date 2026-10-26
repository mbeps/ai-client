import { persistAssistantResponse } from "@/lib/chat/persist-response";
import { executeToolDownloadFallback } from "@/lib/chat/tool-download-fallback";
import type { ChatStreamEvent } from "@/lib/inngest/chat-channel";
import { buildAssistantMessageMetadata } from "@/lib/inngest/chat-response/chat-execution-config";
import type { CompletedToolRecord } from "@/lib/inngest/chat-response/chat-response-types";
import { getLogger } from "@/lib/logger";

const log = getLogger(["inngest", "chat", "response"]);

/**
 * Represents complete assistant response params.
 *
 * @author Maruf Bepary
 */
export interface CompleteAssistantResponseParams {
  chatId: string;
  assistantMessageId: string;
  userMessageId: string;
  accumulatedText: string;
  accumulatedReasoning: string;
  resolvedModelId: string;
  completedTools: CompletedToolRecord[];
  allTools?: Record<string, any>;
  toolSourceMap: Record<string, string>;
  safeFinishReason: Promise<string>;
  safeUsage: Promise<any>;
  abortSignal: AbortSignal;
  emit: (data: ChatStreamEvent) => Promise<void>;
}

/**
 * Executes download fallback, builds metadata, persists assistant message, and emits finish event.
 *
 * @param params - Target params
 * @returns The resolved result
 * @author Maruf Bepary
 */
export async function completeAssistantResponse(
  params: CompleteAssistantResponseParams,
): Promise<void> {
  const {
    chatId,
    assistantMessageId,
    userMessageId,
    accumulatedText,
    accumulatedReasoning,
    resolvedModelId,
    completedTools,
    allTools,
    toolSourceMap,
    safeFinishReason,
    safeUsage,
    abortSignal,
    emit,
  } = params;

  if (allTools) {
    await executeToolDownloadFallback({
      completedTools,
      activeTools: allTools,
      toolSourceMap,
      emit,
    });
  }

  const finishReason = await safeFinishReason;
  const usage = await safeUsage;

  const metadata = buildAssistantMessageMetadata({
    modelId: resolvedModelId,
    reasoning: accumulatedReasoning,
    completedTools,
    usage,
    finishReason,
  });

  // Pre-persistence abort check: halt if aborted during completion processing
  if (abortSignal.aborted) {
    log.info(
      "Chat generation cleanly aborted before persistence (chatId: {chatId})",
      { chatId },
    );
    return;
  }

  // Persist completed assistant message to database
  const persisted = await persistAssistantResponse({
    chatId,
    assistantMessageId,
    content: accumulatedText,
    parentId: userMessageId,
    metadata,
  });

  if (!persisted) {
    log.info(
      "Chat was deleted concurrently; skipping completion emit (chatId: {chatId})",
      { chatId },
    );
    return;
  }

  await emit({
    type: "finish",
    finishReason,
    usage,
  });

  log.info(
    "Chat response successfully generated and persisted (chatId: {chatId}, messageId: {assistantMessageId})",
    { chatId, assistantMessageId },
  );
}
