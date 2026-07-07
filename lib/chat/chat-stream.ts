import { type StreamTextResult } from "ai";
import { logger } from "@/lib/logger";
import { encodeSSE } from "@/lib/encode-sse";
import { isRateLimitError } from "@/lib/error/is-rate-limit-error";
import { normalizeRateLimitMessage } from "@/lib/error/normalize-rate-limit-message";
import { RATE_LIMIT_ERROR_CODE } from "@/constants/errors";
import { handleStreamChunk } from "@/lib/chat/stream-chunk-handler";
import { persistAssistantResponse } from "@/lib/chat/persist-response";
import { type StreamState } from "@/types/chat/stream-state";

interface CreateChatStreamOptions {
  result: StreamTextResult<any, any>;
  chatId: string;
  userId: string;
  userMessageId?: string | null;
  resolvedModelId: string;
  toolSourceMap: Record<string, string>;
  assistantMessageId?: string;
}

/**
 * Creates a ReadableStream that consumes the result of streamText and yields encoded SSE chunks.
 * Handles state accumulation, error mapping, and assistant response persistence.
 */
export function createChatStream(options: CreateChatStreamOptions) {
  const {
    result,
    chatId,
    userId,
    userMessageId,
    resolvedModelId,
    toolSourceMap,
    assistantMessageId = crypto.randomUUID(),
  } = options;

  return new ReadableStream({
    async start(controller) {
      const streamState: StreamState = {
        fullText: "",
        fullReasoning: "",
        toolCalls: [],
        toolResults: [],
      };

      try {
        for await (const chunk of result.fullStream) {
          const { ssePayload, stateUpdates } = handleStreamChunk(
            chunk as any,
            streamState,
            { chatId, userId, toolSourceMap },
          );

          if (stateUpdates.fullText !== undefined)
            streamState.fullText = stateUpdates.fullText;
          if (stateUpdates.fullReasoning !== undefined)
            streamState.fullReasoning = stateUpdates.fullReasoning;
          if (stateUpdates.toolCalls !== undefined)
            streamState.toolCalls = stateUpdates.toolCalls;
          if (stateUpdates.toolResults !== undefined)
            streamState.toolResults = stateUpdates.toolResults;

          if (ssePayload) {
            controller.enqueue(encodeSSE(ssePayload));
          }
        }
      } catch (err: any) {
        logger.error("[Chat Stream Error]", err, { chatId }, userId);
        let message = "An error occurred during generation";
        let code = "ERROR";

        if (isRateLimitError(err)) {
          message = normalizeRateLimitMessage(err);
          code = RATE_LIMIT_ERROR_CODE;
        }

        controller.enqueue(encodeSSE({ type: "error", message, code }));
        controller.close();
        return;
      }

      if (
        !streamState.fullText &&
        streamState.toolCalls.length === 0 &&
        !streamState.fullReasoning
      ) {
        controller.enqueue(
          encodeSSE({ type: "error", message: "No response from model" }),
        );
        controller.close();
        return;
      }

      // Persist assistant response
      const metadataObj: Record<string, any> = {};
      if (streamState.toolCalls.length > 0) {
        metadataObj.toolCalls = streamState.toolCalls;
        metadataObj.toolResults = streamState.toolResults;
      }
      if (streamState.fullReasoning) {
        metadataObj.reasoning = streamState.fullReasoning;
      }
      metadataObj.model = resolvedModelId;

      await persistAssistantResponse({
        chatId,
        assistantMessageId,
        content: streamState.fullText,
        parentId: userMessageId ?? undefined,
        metadata:
          Object.keys(metadataObj).length > 0
            ? JSON.stringify(metadataObj)
            : null,
      });

      logger.info(
        "[Chat Stream] Response completed",
        {
          chatId,
          assistantMessageId,
          textLength: streamState.fullText.length,
          toolCallsCount: streamState.toolCalls.length,
        },
        userId,
      );

      controller.enqueue(
        encodeSSE({
          type: "done",
          id: assistantMessageId,
          metadata:
            Object.keys(metadataObj).length > 0 ? metadataObj : undefined,
        }),
      );

      controller.close();
    },
  });
}
