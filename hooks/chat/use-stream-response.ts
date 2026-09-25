"use client";

import { useRealtime } from "inngest/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { buildChatFromRows } from "@/actions/chats/build-chat";
import { getChatRealtimeToken } from "@/actions/chats/chat-realtime-token";
import { getChat } from "@/actions/chats/get-chat";
import { persistMessage } from "@/actions/chats/persist-message";
import { PROMPTS } from "@/config/prompts";
import { useApiError } from "@/hooks/use-api-error";
import { processAttachments } from "@/lib/chat/attachments/process-attachments";
import { resolveMcpPrompt } from "@/lib/chat/resolve-mcp-prompt";
import { resolveSlashPrompt } from "@/lib/chat/resolve-slash-prompt";
import { type ChatStreamEvent, chatChannel } from "@/lib/inngest/channels";
import { logger } from "@/lib/logger";
import { useAppStore } from "@/lib/store";
import type { Attachment } from "@/types/attachment/attachment";
import type { ToolCallState } from "@/types/tool/tool-call";

/**
 * Builds the metadata object for the user message, tracking model, tools, and prompt info.
 * @author Maruf Bepary
 */
function buildMetadata(
  model: string,
  selectedServerIds: string[],
  selectedTools: string[],
  selectedAssistantId?: string,
  selectedKbIds?: string[],
  selectedSkillIds?: string[],
): Record<string, unknown> {
  const metadataObj: Record<string, unknown> = {
    model,
    selectedServerIds,
    selectedTools,
  };
  if (selectedAssistantId) metadataObj.assistantId = selectedAssistantId;
  if (selectedKbIds && selectedKbIds.length > 0) {
    metadataObj.selectedKbIds = selectedKbIds;
  }
  if (selectedSkillIds && selectedSkillIds.length > 0) {
    metadataObj.selectedSkillIds = selectedSkillIds;
  }
  return metadataObj;
}

/**
 * Resolves the final message content by handling MCP prompts and slash-command prompts.
 * @author Maruf Bepary
 */
async function resolveContent(
  content: string,
  selectedPromptId?: string,
  metadataObj?: Record<string, unknown>,
): Promise<{ fullContent: string }> {
  const meta = metadataObj ?? {};
  if (!selectedPromptId) return { fullContent: content };

  if (selectedPromptId.startsWith("mcp:")) {
    const parts = selectedPromptId.split(":");
    const serverId = parts[1];
    const promptName = parts.slice(2).join(":");

    try {
      const mcpContent = await resolveMcpPrompt(serverId, promptName);
      meta.promptId = selectedPromptId;
      meta.userContent = content;
      return {
        fullContent:
          mcpContent + PROMPTS.COMPOSITION.SLASH_PROMPT_SEPARATOR + content,
      };
    } catch (err) {
      logger.error("Failed to load MCP prompt", err);
      toast.error("Failed to load MCP prompt. Sending message without it.");
      return { fullContent: content };
    }
  }

  const prompts = useAppStore.getState().prompts;
  const { fullContent, metadata } = resolveSlashPrompt(
    selectedPromptId,
    content,
    prompts,
  );
  Object.assign(meta, metadata);
  return { fullContent };
}

interface StreamRequestOptions {
  chatId: string;
  userMessageId: string;
  model?: string;
  selectedServerIds?: string[];
  selectedTools?: string[];
  selectedAssistantId?: string;
  selectedSkillIds?: string[];
  selectedKbIds?: string[];
}

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
  const addMessage = useAppStore((state) => state.addMessage);
  const upsertChat = useAppStore((state) => state.upsertChat);
  const updateMessageAttachments = useAppStore(
    (state) => state.updateMessageAttachments,
  );

  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [streamingReasoning, setStreamingReasoning] = useState<string | null>(
    null,
  );
  const [activeToolCalls, setActiveToolCalls] = useState<ToolCallState[]>([]);

  const pendingRef = useRef<{
    userMessageId: string | null;
    model: string;
    startTime: number;
  }>({ userMessageId: null, model: "", startTime: 0 });

  const lastChunkTimeRef = useRef(0);
  const accumulatedTextRef = useRef("");
  const accumulatedReasoningRef = useRef("");
  const assistantMessageIdRef = useRef<string | null>(null);
  const activeToolCallsRef = useRef<ToolCallState[]>([]);
  const stoppedRef = useRef(false);

  const handleStreamEvent = useCallback(
    (event: ChatStreamEvent) => {
      if (stoppedRef.current) return;
      switch (event.type) {
        case "start":
          lastChunkTimeRef.current = Date.now();
          assistantMessageIdRef.current = event.messageId;
          setIsStreaming(true);
          break;

        case "text-delta":
          lastChunkTimeRef.current = Date.now();
          accumulatedTextRef.current += event.text;
          setStreamingContent(accumulatedTextRef.current);
          setIsStreaming(true);
          break;

        case "reasoning-delta":
          lastChunkTimeRef.current = Date.now();
          accumulatedReasoningRef.current += event.reasoning;
          setStreamingReasoning(accumulatedReasoningRef.current);
          setIsStreaming(true);
          break;

        case "tool-call": {
          lastChunkTimeRef.current = Date.now();
          const toolCall: ToolCallState = {
            toolCallId: event.toolCallId,
            toolName: event.toolName,
            args: event.args,
            status: "calling",
          };
          activeToolCallsRef.current = [
            ...activeToolCallsRef.current.filter(
              (t) => t.toolCallId !== event.toolCallId,
            ),
            toolCall,
          ];
          setActiveToolCalls([...activeToolCallsRef.current]);
          setIsStreaming(true);
          break;
        }

        case "tool-result": {
          lastChunkTimeRef.current = Date.now();
          activeToolCallsRef.current = activeToolCallsRef.current.map((t) =>
            t.toolCallId === event.toolCallId
              ? { ...t, status: "complete", result: event.result }
              : t,
          );
          setActiveToolCalls([...activeToolCallsRef.current]);
          setIsStreaming(true);
          break;
        }

        case "finish": {
          lastChunkTimeRef.current = 0;
          const text = accumulatedTextRef.current;
          const reasoning = accumulatedReasoningRef.current;
          const completedTools = activeToolCallsRef.current.filter(
            (tc) => tc.status === "complete",
          );

          if (text || reasoning || completedTools.length > 0) {
            const assistantId =
              assistantMessageIdRef.current || crypto.randomUUID();
            const durationMs =
              pendingRef.current.startTime > 0
                ? Date.now() - pendingRef.current.startTime
                : undefined;

            const metadata = JSON.stringify({
              model: pendingRef.current.model,
              reasoning,
              toolCalls: completedTools.map((tc) => ({
                toolCallId: tc.toolCallId,
                toolName: tc.toolName,
                args: tc.args,
              })),
              toolResults: completedTools
                .filter((tc) => tc.result !== undefined)
                .map((tc) => ({
                  toolCallId: tc.toolCallId,
                  toolName: tc.toolName,
                  result: tc.result,
                })),
              usage: event.usage,
              finishReason: event.finishReason,
              durationMs,
            });

            addMessage(chatId, {
              role: "assistant",
              content: text,
              parentId: pendingRef.current.userMessageId,
              id: assistantId,
              metadata,
              reasoning: reasoning || undefined,
            });

            options?.onDone?.(text);
          }

          setIsStreaming(false);
          setStreamingContent(null);
          setStreamingReasoning(null);
          setActiveToolCalls([]);
          break;
        }

        case "error": {
          lastChunkTimeRef.current = 0;
          if (!handleApiError(event)) {
            toast.error(event.message || "Failed to generate response");
          }
          setIsStreaming(false);
          setStreamingContent(null);
          setStreamingReasoning(null);
          setActiveToolCalls([]);
          break;
        }
      }
    },
    [chatId, addMessage, handleApiError, options],
  );

  const fetchChatToken = useCallback(
    () =>
      chatId
        ? getChatRealtimeToken(chatId)
        : Promise.reject(new Error("No chatId")),
    [chatId],
  );

  const apiBaseUrl = useMemo(() => {
    if (typeof window === "undefined") return undefined;
    if (process.env.NODE_ENV !== "production") {
      return `${window.location.protocol}//${window.location.hostname}:8288`;
    }
    return undefined;
  }, []);

  const {
    messages,
    error: realtimeError,
    connectionStatus,
  } = useRealtime({
    channel: chatId ? chatChannel({ chatId }) : undefined,
    topics: ["stream"] as const,
    token: fetchChatToken,
    enabled: !!chatId,
    historyLimit: null,
    apiBaseUrl,
  });

  const syncFromDb = useCallback(async () => {
    if (!chatId) return false;
    try {
      const data = await getChat(chatId);
      const userMsgId = pendingRef.current.userMessageId;
      const assistantMsg = data.messages.find(
        (m) =>
          m.role === "assistant" &&
          (userMsgId
            ? m.parentId === userMsgId
            : new Date(m.createdAt).getTime() >=
              pendingRef.current.startTime - 2000),
      );

      if (assistantMsg) {
        const fullChat = buildChatFromRows(data);
        upsertChat(fullChat);
        options?.onDone?.(assistantMsg.content);
        setIsStreaming(false);
        setStreamingContent(null);
        setStreamingReasoning(null);
        setActiveToolCalls([]);
        return true;
      }
    } catch (err) {
      logger.error("Failed to sync chat from DB", err);
    }
    return false;
  }, [chatId, upsertChat, options]);

  const connectionStatusRef = useRef(connectionStatus);
  useEffect(() => {
    connectionStatusRef.current = connectionStatus;
  }, [connectionStatus]);

  useEffect(() => {
    if (realtimeError) {
      logger.error("Inngest Realtime connection error:", realtimeError);
    }
    if ((realtimeError || connectionStatus === "error") && isStreaming) {
      void syncFromDb();
    }
  }, [realtimeError, connectionStatus, isStreaming, syncFromDb]);

  const lastProcessedIndexRef = useRef(0);
  const processedMessagesRef = useRef<WeakSet<object>>(new WeakSet());

  // biome-ignore lint/correctness/useExhaustiveDependencies: Reset pointer on chatId change
  useEffect(() => {
    lastProcessedIndexRef.current = 0;
  }, [chatId]);

  useEffect(() => {
    const all = messages.all;
    if (all && all.length > 0) {
      if (all.length < lastProcessedIndexRef.current) {
        lastProcessedIndexRef.current = 0;
      }
      if (all.length > lastProcessedIndexRef.current) {
        for (let i = lastProcessedIndexRef.current; i < all.length; i++) {
          const msg = all[i];
          if (
            msg &&
            typeof msg === "object" &&
            !processedMessagesRef.current.has(msg)
          ) {
            processedMessagesRef.current.add(msg);
            if (msg.data) {
              handleStreamEvent(msg.data as ChatStreamEvent);
            }
          }
        }
        lastProcessedIndexRef.current = all.length;
      }
      return;
    }

    // Fallback if environment only provides delta (e.g. legacy test mocks)
    if (messages.delta && messages.delta.length > 0) {
      for (const msg of messages.delta) {
        if (
          msg &&
          typeof msg === "object" &&
          !processedMessagesRef.current.has(msg)
        ) {
          processedMessagesRef.current.add(msg);
          if (msg.data) {
            handleStreamEvent(msg.data as ChatStreamEvent);
          }
        }
      }
    }
  }, [messages.all, messages.delta, handleStreamEvent]);

  // Watchdog & connection error recovery: prevent permanent "Thinking..." state
  useEffect(() => {
    if (!isStreaming) return;

    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      const timeSinceLastChunk = Date.now() - lastChunkTimeRef.current;
      const timeSinceStart = Date.now() - pendingRef.current.startTime;

      const isConnectionError =
        connectionStatusRef.current === "error" || Boolean(realtimeError);
      const isStalled = timeSinceStart > 5000 && timeSinceLastChunk > 5000;

      if (isConnectionError || isStalled) {
        const synced = await syncFromDb();
        if (synced) {
          clearInterval(interval);
          return;
        }

        if ((isConnectionError && attempts >= 10) || attempts >= 30) {
          clearInterval(interval);
          setIsStreaming(false);
          setStreamingContent(null);
          setStreamingReasoning(null);
          setActiveToolCalls([]);
          if (isConnectionError) {
            toast.error(
              "Connection lost to generation stream. Please refresh if response is ready.",
            );
          }
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isStreaming, realtimeError, syncFromDb]);

  const isLoading = isStreaming;
  const isStreamingReasoning =
    isStreaming && !!streamingReasoning && !streamingContent;

  const stopStream = useCallback(() => {
    stoppedRef.current = true;

    const partialText = accumulatedTextRef.current;
    const messageId = assistantMessageIdRef.current || crypto.randomUUID();
    const chat = useAppStore.getState().chats?.[chatId];
    const userMsgId =
      pendingRef.current.userMessageId ||
      (chat?.currentLeafId && chat.messages[chat.currentLeafId]?.role === "user"
        ? chat.currentLeafId
        : null);

    // If there is partial streamed text, commit it immediately so the UI
    // does not go blank and the content survives a page refresh.
    if (partialText && userMsgId) {
      addMessage(chatId, {
        role: "assistant",
        content: partialText,
        parentId: userMsgId,
        id: messageId,
        metadata: JSON.stringify({
          model: pendingRef.current.model,
          finishReason: "stop",
        }),
      });
      persistMessage(chatId, {
        id: messageId,
        role: "assistant",
        content: partialText,
        parentId: userMsgId,
        metadata: JSON.stringify({
          model: pendingRef.current.model,
          finishReason: "stop",
        }),
      }).catch((err) => {
        logger.error("Failed to persist stopped message", err);
      });
    }

    lastChunkTimeRef.current = 0;
    setIsStreaming(false);
    setStreamingContent(null);
    setStreamingReasoning(null);
    setActiveToolCalls([]);
    fetch("/api/chat/stop", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chatId }),
    }).catch(() => {});
  }, [chatId, addMessage]);

  const streamResponse = async (
    userMsgId: string,
    content: string,
    parentId: string | null,
    attachments: Attachment[] = [],
    model = "",
    selectedServerIds: string[] = [],
    selectedTools: string[] = [],
    selectedPromptId?: string,
    selectedAssistantId?: string,
    selectedKbIds: string[] = [],
    selectedSkillIds: string[] = [],
  ): Promise<string> => {
    pendingRef.current = {
      userMessageId: userMsgId,
      model,
      startTime: Date.now(),
    };
    lastChunkTimeRef.current = Date.now();

    stoppedRef.current = false;
    accumulatedTextRef.current = "";
    accumulatedReasoningRef.current = "";
    assistantMessageIdRef.current = null;
    activeToolCallsRef.current = [];
    setStreamingContent(null);
    setStreamingReasoning(null);
    setActiveToolCalls([]);
    setIsStreaming(true);

    // 1. Build metadata object
    const metadataObj = buildMetadata(
      model,
      selectedServerIds,
      selectedTools,
      selectedAssistantId,
      selectedKbIds,
      selectedSkillIds,
    );

    // 2. Resolve prompt content (MCP / slash-command)
    const { fullContent } = await resolveContent(
      content,
      selectedPromptId,
      metadataObj,
    );
    const userMsgMetadata = JSON.stringify(metadataObj);

    // 3. Optimistic store insert
    addMessage(chatId, {
      role: "user",
      content: fullContent,
      parentId,
      id: userMsgId,
      metadata: userMsgMetadata,
      attachments,
    });

    // 4. Persist BEFORE the API call — the server reads this row to rebuild
    //    the thread; a missing row would silently truncate context.
    try {
      await persistMessage(chatId, {
        id: userMsgId,
        role: "user",
        content: fullContent,
        parentId,
        metadata: userMsgMetadata ?? undefined,
      });
    } catch (err) {
      logger.error("Failed to persist message", err);
      toast.error(
        "Message may not have been saved. Please check your connection.",
      );
    }

    // 5. Upload attachments
    const uploadedAttachments = await processAttachments(
      attachments,
      userMsgId,
    );
    if (uploadedAttachments.length > 0) {
      updateMessageAttachments(chatId, userMsgId, uploadedAttachments);
    }

    // 6. Dispatch background job to Inngest via /api/chat
    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chatId,
          userMessageId: userMsgId,
          model,
          selectedServerIds,
          selectedTools,
          selectedAssistantId,
          selectedSkillIds,
          selectedKbIds,
        } satisfies StreamRequestOptions),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        if (!handleApiError(errorData)) {
          toast.error(errorData.error || "Failed to generate response");
        }
        setIsStreaming(false);
      }
    } catch (err: any) {
      if (!handleApiError(err)) {
        toast.error(err.message || "Failed to generate response");
      }
      setIsStreaming(false);
    }

    return "";
  };

  return {
    isLoading,
    streamingContent,
    streamingReasoning,
    isStreamingReasoning,
    activeToolCalls,
    streamResponse,
    stopStream,
  };
}
