import { useCallback } from "react";
import { toast } from "sonner";
import { getChat } from "@/actions/chats/get-chat";
import {
  findMatchingAssistantMessage,
  isAccessOrNotFoundError,
} from "@/hooks/chat/stream/use-stream-db-sync";
import {
  clearInflightState,
  saveInflightState,
} from "@/hooks/chat/stream/use-stream-inflight-state";
import type {
  PendingRefState,
  StreamDeltaRefs,
  StreamDeltaSetters,
  StreamRefsObject,
} from "@/hooks/chat/stream/use-stream-types";
import { extractSkillChangesFromToolResults } from "@/lib/chat/extract-skill-changes-from-tool-results";
import { buildChatFromRows } from "@/lib/chat/message-tree-utils";
import {
  accumulateReasoningDelta,
  accumulateTextDelta,
} from "@/lib/chat/stream/accumulate-stream-chunks";
import { applyToolResultEvent } from "@/lib/chat/stream/apply-tool-result-event";
import { buildAssistantFinishMetadata } from "@/lib/chat/stream/build-assistant-finish-metadata";
import { extractCompletedToolResults } from "@/lib/chat/stream/extract-completed-tool-results";
import { applyToolCallEvent } from "@/lib/chat/stream/handle-stream-tool-calls";
import type { ChatStreamEvent } from "@/lib/inngest/chat-channel";
import { logger } from "@/lib/logger";
import { useAppStore } from "@/lib/store/use-app-store";
import type { Chat } from "@/types/chat/chat";
import type { ToolCallState } from "@/types/tool/tool-call";

/**
 * Applies incoming streaming delta chunks (text, reasoning, tool-call, tool-result) to state.
 * @author Maruf Bepary
 */
export function applyStreamDelta(
  event: Extract<
    ChatStreamEvent,
    | { type: "start" }
    | { type: "text-delta" }
    | { type: "reasoning-delta" }
    | { type: "tool-call" }
    | { type: "tool-result" }
  >,
  refs: StreamDeltaRefs,
  setters: StreamDeltaSetters,
) {
  refs.lastChunkTimeRef.current = Date.now();
  setters.setIsStreaming(true);

  switch (event.type) {
    case "start":
      refs.assistantMessageIdRef.current = event.messageId;
      setters.setAssistantMessageId(event.messageId);
      break;
    case "text-delta":
      refs.accumulatedTextRef.current = accumulateTextDelta(
        refs.accumulatedTextRef.current,
        event.text,
      );
      setters.setStreamingContent(refs.accumulatedTextRef.current);
      break;
    case "reasoning-delta":
      refs.accumulatedReasoningRef.current = accumulateReasoningDelta(
        refs.accumulatedReasoningRef.current,
        event.reasoning,
      );
      setters.setStreamingReasoning(refs.accumulatedReasoningRef.current);
      break;
    case "tool-call":
      refs.activeToolCallsRef.current = applyToolCallEvent(
        refs.activeToolCallsRef.current,
        event,
      );
      setters.setActiveToolCalls([...refs.activeToolCallsRef.current]);
      break;
    case "tool-result":
      refs.activeToolCallsRef.current = applyToolResultEvent(
        refs.activeToolCallsRef.current,
        event,
      );
      setters.setActiveToolCalls([...refs.activeToolCallsRef.current]);
      break;
  }
}

/**
 * Refetches complete chat from DB when rejoining client receives finish event.
 * @author Maruf Bepary
 */
export async function executeRejoinFinish(
  chatId: string,
  upsertChat: (chat: Chat) => void,
  userMsgId: string | null,
  assistantId: string | null,
  onDone?: (content: string) => void,
) {
  const chatExists = Boolean(useAppStore.getState().chats?.[chatId]);
  if (!chatId || !chatExists) return;

  try {
    const data = await getChat(chatId);
    const fullChat = buildChatFromRows(data);
    upsertChat(fullChat);

    const assistantMsg = findMatchingAssistantMessage(
      data.messages,
      assistantId,
      userMsgId,
    );

    if (assistantMsg && onDone) {
      onDone(assistantMsg.content);
    }
  } catch (err) {
    if (!isAccessOrNotFoundError(err)) {
      logger.error("Failed to refetch chat on rejoin finish", err);
    }
  }
}

/**
 * Builds assistant message with metadata, adds to store, and calls onDone callback.
 * @author Maruf Bepary
 */
export function executeStandardFinish(params: {
  chatId: string;
  event: Extract<ChatStreamEvent, { type: "finish" }>;
  text: string;
  reasoning: string;
  activeToolCalls: ToolCallState[];
  assistantId: string | null;
  pending: PendingRefState;
  addMessage: (chatId: string, msg: any) => void;
  onDone?: (content: string) => void;
}) {
  const completedTools = params.activeToolCalls.filter(
    (tc) => tc.status === "complete",
  );

  if (!params.text && !params.reasoning && completedTools.length === 0) return;

  const resolvedAssistantId = params.assistantId || crypto.randomUUID();
  const durationMs = Date.now() - params.pending.startTime;

  const toolResults = extractCompletedToolResults(completedTools);

  if (extractSkillChangesFromToolResults(toolResults).length > 0) {
    void useAppStore.getState().loadSkills();
  }

  const metadata = buildAssistantFinishMetadata({
    model: params.pending.model,
    reasoning: params.reasoning,
    completedTools,
    toolResults,
    usage: params.event.usage,
    finishReason: params.event.finishReason,
    durationMs,
  });

  params.addMessage(params.chatId, {
    role: "assistant",
    content: params.text,
    parentId: params.pending.userMessageId,
    id: resolvedAssistantId,
    metadata,
    reasoning: params.reasoning || undefined,
  });

  if (params.onDone) {
    params.onDone(params.text);
  }
}

/**
 * Hook providing handleStreamEvent callback dispatching stream deltas, finish, and error events.
 * @author Maruf Bepary
 */
export function useStreamEventHandlers(params: {
  chatId: string;
  options?: { onDone?: (content: string) => void };
  upsertChat: (chat: Chat) => void;
  addMessage: (chatId: string, msg: any) => void;
  handleApiError: (err: unknown) => boolean;
  resetStreamingState: () => void;
  streamRefs: StreamRefsObject;
  streamSetters: StreamDeltaSetters;
}) {
  const {
    chatId,
    options,
    upsertChat,
    addMessage,
    handleApiError,
    resetStreamingState,
    streamRefs,
    streamSetters,
  } = params;

  const handleRejoinFinish = useCallback(async () => {
    await executeRejoinFinish(
      chatId,
      upsertChat,
      streamRefs.pendingRef.current.userMessageId,
      streamRefs.assistantMessageIdRef.current,
      options?.onDone,
    );
  }, [chatId, upsertChat, options, streamRefs]);

  const handleStandardFinish = useCallback(
    (event: Extract<ChatStreamEvent, { type: "finish" }>) => {
      executeStandardFinish({
        chatId,
        event,
        text: streamRefs.accumulatedTextRef.current,
        reasoning: streamRefs.accumulatedReasoningRef.current,
        activeToolCalls: streamRefs.activeToolCallsRef.current,
        assistantId: streamRefs.assistantMessageIdRef.current,
        pending: streamRefs.pendingRef.current,
        addMessage,
        onDone: options?.onDone,
      });
    },
    [chatId, addMessage, options, streamRefs],
  );

  const handleStreamEvent = useCallback(
    async (event: ChatStreamEvent) => {
      if (streamRefs.stoppedRef.current) return;
      if (streamRefs.pendingRef.current.userMessageId === null) {
        streamRefs.rejoinedRef.current = true;
      }

      if (event.type === "finish") {
        streamRefs.lastChunkTimeRef.current = 0;
        if (streamRefs.rejoinedRef.current) {
          await handleRejoinFinish();
        } else {
          handleStandardFinish(event);
        }
        clearInflightState(chatId);
        resetStreamingState();
        return;
      }

      if (event.type === "error") {
        streamRefs.lastChunkTimeRef.current = 0;
        clearInflightState(chatId);
        if (!handleApiError(event)) {
          toast.error(event.message || "Failed to generate response");
        }
        resetStreamingState();
        return;
      }

      applyStreamDelta(
        event,
        {
          lastChunkTimeRef: streamRefs.lastChunkTimeRef,
          assistantMessageIdRef: streamRefs.assistantMessageIdRef,
          accumulatedTextRef: streamRefs.accumulatedTextRef,
          accumulatedReasoningRef: streamRefs.accumulatedReasoningRef,
          activeToolCallsRef: streamRefs.activeToolCallsRef,
        },
        streamSetters,
      );

      saveInflightState(chatId, {
        text: streamRefs.accumulatedTextRef.current,
        reasoning: streamRefs.accumulatedReasoningRef.current,
        toolCalls: streamRefs.activeToolCallsRef.current,
        assistantMessageId: streamRefs.assistantMessageIdRef.current,
      });
    },
    [
      chatId,
      handleRejoinFinish,
      handleStandardFinish,
      handleApiError,
      resetStreamingState,
      streamRefs,
      streamSetters,
    ],
  );

  return { handleStreamEvent };
}
