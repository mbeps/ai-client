"use client";

import { useCallback, useEffect, useMemo } from "react";
import { getChat } from "@/actions/chats/get-chat";
import {
  applySyncedAssistantMessage,
  findMatchingAssistantMessage,
  handleSyncError,
  hasValidSyncTarget,
  isChatInStore,
  resolveSyncTargetParentId,
} from "@/hooks/chat/stream/use-stream-db-sync";
import { executeStreamResponse } from "@/hooks/chat/stream/use-stream-dispatch";
import { useStreamEventHandlers } from "@/hooks/chat/stream/use-stream-event-handlers";
import { useStreamRealtimeChannel } from "@/hooks/chat/stream/use-stream-realtime";
import {
  useStreamMountRejoin,
  useStreamRefs,
  useStreamState,
  useStreamStore,
} from "@/hooks/chat/stream/use-stream-state-hooks";
import { executeStopStream } from "@/hooks/chat/stream/use-stream-stop";
import { useStreamWatchdog } from "@/hooks/chat/stream/use-stream-watchdog";
import { useApiError } from "@/hooks/use-api-error";
import type { Attachment } from "@/types/attachment/attachment";

/**
 * Orchestrates AI response generation using Inngest background jobs and Inngest Realtime.
 *
 * Dispatches durable generation jobs that continue in the background even if the user
 * navigates away or refreshes the page. Listens to token deltas, reasoning, and tool calls
 * in real-time over the Inngest Realtime chat channel.
 *
 * @param chatId - Target chat session ID for message persistence.
 * @param options - Optional callbacks: onDone invoked with final content string on stream completion.
 * @returns isLoading, streaming content/reasoning/tool-call state, streamResponse, stopStream.
 * @see ChatUI for the primary consumer.
 * @author Maruf Bepary
 */
export function useStreamResponse(
  chatId: string,
  options?: {
    onDone?: (content: string) => void;
  },
) {
  const { handleApiError } = useApiError();
  const { addMessage, upsertChat, updateMessageAttachments, currentChat } =
    useStreamStore(chatId);
  const streamState = useStreamState();
  const streamRefs = useStreamRefs();

  const {
    isStreaming,
    setIsStreaming,
    streamingContent,
    setStreamingContent,
    streamingReasoning,
    setStreamingReasoning,
    activeToolCalls,
    setActiveToolCalls,
    assistantMessageId,
    setAssistantMessageId,
    chatNotFound,
    setChatNotFound,
    resetStreamingState,
  } = streamState;

  const activeLeaf = useMemo(() => {
    if (!currentChat?.currentLeafId) return undefined;
    return currentChat.messages?.[currentChat.currentLeafId];
  }, [currentChat]);

  const syncFromDb = useCallback(async () => {
    if (!isChatInStore(chatId)) return false;

    try {
      const data = await getChat(chatId);
      const userMsgId = streamRefs.pendingRef.current.userMessageId;
      const assistantId = streamRefs.assistantMessageIdRef.current;
      const targetParentId = resolveSyncTargetParentId(userMsgId, activeLeaf);

      if (!hasValidSyncTarget(assistantId, targetParentId)) {
        return false;
      }

      const assistantMsg = findMatchingAssistantMessage(
        data.messages,
        assistantId,
        targetParentId,
      );

      if (assistantMsg) {
        applySyncedAssistantMessage(
          chatId,
          data,
          assistantMsg,
          upsertChat,
          options ? options.onDone : undefined,
        );
        resetStreamingState();
        return true;
      }
    } catch (err) {
      handleSyncError(err, setChatNotFound, resetStreamingState);
    }
    return false;
  }, [
    chatId,
    upsertChat,
    options,
    activeLeaf,
    resetStreamingState,
    streamRefs,
    setChatNotFound,
  ]);

  useStreamMountRejoin(
    chatId,
    currentChat,
    activeLeaf,
    isStreaming,
    syncFromDb,
    streamRefs,
    {
      setIsStreaming,
      setStreamingContent,
      setStreamingReasoning,
      setActiveToolCalls,
      setAssistantMessageId,
    },
  );

  const { handleStreamEvent } = useStreamEventHandlers({
    chatId,
    options,
    upsertChat,
    addMessage,
    handleApiError,
    resetStreamingState,
    streamRefs,
    streamSetters: {
      setAssistantMessageId,
      setStreamingContent,
      setStreamingReasoning,
      setActiveToolCalls,
      setIsStreaming,
    },
  });

  const realtime = useStreamRealtimeChannel(
    chatId,
    chatNotFound,
    setChatNotFound,
    resetStreamingState,
    handleStreamEvent,
  );

  // biome-ignore lint/correctness/useExhaustiveDependencies: Reset pointer and streaming state on chatId change
  useEffect(() => {
    streamRefs.rejoinedRef.current = false;
    streamRefs.pendingRef.current = {
      userMessageId: null,
      model: "",
      startTime: 0,
    };
    resetStreamingState();
    setChatNotFound(false);
  }, [chatId]);

  useStreamWatchdog(
    chatId,
    isStreaming,
    chatNotFound,
    realtime.connectionStatus,
    realtime.error,
    syncFromDb,
    setIsStreaming,
    streamRefs,
  );

  const isLoading = isStreaming;
  const isStreamingReasoning =
    isStreaming && !!streamingReasoning && !streamingContent;

  const stopStream = useCallback(async () => {
    await executeStopStream(
      chatId,
      addMessage,
      resetStreamingState,
      streamRefs,
    );
  }, [chatId, addMessage, resetStreamingState, streamRefs]);

  const streamResponse = useCallback(
    async (
      userMsgId: string,
      content: string,
      parentId: string | null,
      attachments: Attachment[] = [],
      model = "",
      selectedServerIds: string[] = [],
      selectedTools: string[] = [],
      selectedPromptId?: string | string[],
      selectedAssistantId?: string,
      selectedKbIds: string[] = [],
      selectedSkillIds: string[] = [],
      subagentsEnabled?: boolean,
      subagentModelId?: string,
    ): Promise<string> => {
      const promptIds = Array.isArray(selectedPromptId)
        ? selectedPromptId
        : selectedPromptId
          ? [selectedPromptId]
          : [];

      return executeStreamResponse({
        chatId,
        userMsgId,
        content,
        parentId,
        attachments,
        model,
        selectedServerIds,
        selectedTools,
        selectedPromptIds: promptIds,
        selectedAssistantId,
        selectedKbIds,
        selectedSkillIds,
        subagentsEnabled,
        subagentModelId,
        addMessage,
        updateMessageAttachments,
        handleApiError,
        resetStreamingState,
        setIsStreaming,
        setChatNotFound,
        refs: streamRefs,
      });
    },
    [
      chatId,
      addMessage,
      updateMessageAttachments,
      handleApiError,
      resetStreamingState,
      setIsStreaming,
      setChatNotFound,
      streamRefs,
    ],
  );

  return {
    isLoading,
    streamingContent,
    streamingReasoning,
    isStreamingReasoning,
    activeToolCalls,
    assistantMessageId,
    streamResponse,
    stopStream,
  };
}
