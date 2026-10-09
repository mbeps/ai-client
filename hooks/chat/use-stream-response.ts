"use client";

import { useRealtime } from "inngest/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { buildChatFromRows } from "@/actions/chats/build-chat";
import { getChatRealtimeToken } from "@/actions/chats/chat-realtime-token";
import { getChat } from "@/actions/chats/get-chat";
import { isChatGenerating } from "@/actions/chats/is-chat-generating";
import { persistMessage } from "@/actions/chats/persist-message";
import { PROMPTS } from "@/config/prompts";
import { useApiError } from "@/hooks/use-api-error";
import { processAttachments } from "@/lib/chat/attachments/process-attachments";
import { extractSkillChangesFromToolResults } from "@/lib/chat/extract-skill-changes-from-tool-results";
import { resolveMcpPrompt } from "@/lib/chat/resolve-mcp-prompt";
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
  subagentsEnabled?: boolean,
  subagentModelId?: string,
  subagentExcludedTools?: string[],
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
  if (subagentsEnabled !== undefined) {
    metadataObj.subagentsEnabled = subagentsEnabled;
  }
  if (subagentModelId) {
    metadataObj.subagentModelId = subagentModelId;
  }
  if (subagentExcludedTools && subagentExcludedTools.length > 0) {
    metadataObj.subagentExcludedTools = subagentExcludedTools;
  }
  return metadataObj;
}

function saveInflightState(
  chatId: string,
  state: {
    text: string;
    reasoning: string;
    toolCalls: ToolCallState[];
    assistantMessageId: string | null;
  },
) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(`chat_inflight_${chatId}`, JSON.stringify(state));
  } catch {}
}

function loadInflightState(chatId: string) {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(`chat_inflight_${chatId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearInflightState(chatId: string) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(`chat_inflight_${chatId}`);
  } catch {}
}

/**
 * Resolves the final message content by handling MCP prompts and slash-command prompts.
 * @author Maruf Bepary
 */
async function resolveContent(
  content: string,
  selectedPromptIds: string[] = [],
  metadataObj?: Record<string, unknown>,
): Promise<{ fullContent: string }> {
  const meta = metadataObj ?? {};
  if (selectedPromptIds.length === 0) return { fullContent: content };

  const promptChunks: string[] = [];
  const prompts = useAppStore.getState().prompts;

  for (const promptId of selectedPromptIds) {
    if (promptId.startsWith("mcp:")) {
      const parts = promptId.split(":");
      const serverId = parts[1];
      const promptName = parts.slice(2).join(":");

      try {
        const mcpContent = await resolveMcpPrompt(serverId, promptName);
        if (mcpContent) promptChunks.push(mcpContent);
      } catch (err) {
        logger.error("Failed to load MCP prompt", err);
        toast.error("Failed to load MCP prompt. Sending message without it.");
      }
    } else {
      const local = prompts.find((p) => p.id === promptId);
      if (local?.content) {
        promptChunks.push(local.content);
      }
    }
  }

  meta.promptIds = selectedPromptIds;
  if (selectedPromptIds[0]) meta.promptId = selectedPromptIds[0];
  meta.userContent = content;

  if (promptChunks.length === 0) {
    return { fullContent: content };
  }

  return {
    fullContent:
      promptChunks.join(PROMPTS.COMPOSITION.SLASH_PROMPT_SEPARATOR) +
      PROMPTS.COMPOSITION.SLASH_PROMPT_SEPARATOR +
      content,
  };
}

interface StreamRequestOptions {
  chatId: string;
  userMessageId: string;
  model?: string;
  selectedServerIds?: string[];
  selectedTools?: string[];
  selectedAssistantId?: string;
  selectedPromptIds?: string[];
  selectedPromptId?: string;
  selectedSkillIds?: string[];
  selectedKbIds?: string[];
  subagentsEnabled?: boolean;
  subagentModelId?: string;
  subagentExcludedTools?: string[];
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
  const [assistantMessageId, setAssistantMessageId] = useState<string | null>(
    null,
  );
  const [chatNotFound, setChatNotFound] = useState(false);

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
  const rejoinedRef = useRef(false);
  const checkedChatIdRef = useRef<string | null>(null);

  const currentChat = useAppStore((state) =>
    chatId ? state.chats?.[chatId] : undefined,
  );

  const activeLeaf = useMemo(() => {
    if (!currentChat?.currentLeafId) return undefined;
    return currentChat.messages?.[currentChat.currentLeafId];
  }, [currentChat]);

  const syncFromDb = useCallback(async () => {
    if (!chatId) return false;
    if (!useAppStore.getState().chats?.[chatId]) return false;
    try {
      const data = await getChat(chatId);
      const userMsgId = pendingRef.current.userMessageId;
      const assistantId = assistantMessageIdRef.current;
      const targetParentId = userMsgId || activeLeaf?.id;

      if (!assistantId && !targetParentId) {
        return false;
      }

      const assistantMsg = data.messages.find(
        (m) =>
          m.role === "assistant" &&
          (assistantId
            ? m.id === assistantId
            : targetParentId
              ? m.parentId === targetParentId
              : true),
      );

      if (assistantMsg) {
        clearInflightState(chatId);
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
      if (
        err instanceof Error &&
        (err.message.includes("Not Found") ||
          err.message.includes("Unauthorized") ||
          err.message.includes("access denied"))
      ) {
        setChatNotFound(true);
        setIsStreaming(false);
        setStreamingContent(null);
        setStreamingReasoning(null);
        setActiveToolCalls([]);
        return false;
      }
      logger.error("Failed to sync chat from DB", err);
    }
    return false;
  }, [chatId, upsertChat, options, activeLeaf]);

  // Mount effect: detect in-flight generation after page refresh
  useEffect(() => {
    if (!chatId) return;
    if (checkedChatIdRef.current === chatId) return;
    if (isStreaming || pendingRef.current.userMessageId !== null) return;
    if (!currentChat) return;

    if (activeLeaf?.role !== "user") {
      checkedChatIdRef.current = chatId;
      return;
    }

    checkedChatIdRef.current = chatId;
    const leafId = activeLeaf.id;

    void isChatGenerating(chatId)
      .then(async (generating) => {
        if (generating && pendingRef.current.userMessageId === null) {
          rejoinedRef.current = true;
          pendingRef.current = {
            userMessageId: leafId,
            model: "",
            startTime: Date.now(),
          };
          lastChunkTimeRef.current = Date.now();

          // Restore in-flight state from sessionStorage if available
          const cached = loadInflightState(chatId);
          if (cached) {
            if (cached.text) {
              accumulatedTextRef.current = cached.text;
              setStreamingContent(cached.text);
            }
            if (cached.reasoning) {
              accumulatedReasoningRef.current = cached.reasoning;
              setStreamingReasoning(cached.reasoning);
            }
            if (
              Array.isArray(cached.toolCalls) &&
              cached.toolCalls.length > 0
            ) {
              activeToolCallsRef.current = cached.toolCalls;
              setActiveToolCalls(cached.toolCalls);
            }
            if (cached.assistantMessageId) {
              assistantMessageIdRef.current = cached.assistantMessageId;
              setAssistantMessageId(cached.assistantMessageId);
            }
          }

          setIsStreaming(true);
        } else if (!generating) {
          clearInflightState(chatId);
          await syncFromDb();
        }
      })
      .catch(() => {
        // Swallow rejections
      });
  }, [chatId, currentChat, activeLeaf, isStreaming, syncFromDb]);

  const handleStreamEvent = useCallback(
    async (event: ChatStreamEvent) => {
      if (stoppedRef.current) return;
      if (pendingRef.current.userMessageId === null) {
        rejoinedRef.current = true;
      }
      switch (event.type) {
        case "start":
          lastChunkTimeRef.current = Date.now();
          assistantMessageIdRef.current = event.messageId;
          setAssistantMessageId(event.messageId);
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
            serverName: event.serverName,
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
          const isPreliminary = Boolean(event.preliminary);
          activeToolCallsRef.current = activeToolCallsRef.current.map((t) =>
            t.toolCallId === event.toolCallId
              ? {
                  ...t,
                  status: isPreliminary ? "calling" : "complete",
                  result: event.result,
                  serverName: event.serverName ?? t.serverName,
                }
              : t,
          );
          setActiveToolCalls([...activeToolCallsRef.current]);
          setIsStreaming(true);
          break;
        }

        case "finish": {
          lastChunkTimeRef.current = 0;
          const chatExists = Boolean(useAppStore.getState().chats?.[chatId]);

          if (rejoinedRef.current) {
            if (chatId && chatExists) {
              try {
                const data = await getChat(chatId);
                const fullChat = buildChatFromRows(data);
                upsertChat(fullChat);

                const userMsgId = pendingRef.current.userMessageId;
                const assistantId = assistantMessageIdRef.current;
                const assistantMsg = data.messages.find(
                  (m) =>
                    m.role === "assistant" &&
                    (assistantId
                      ? m.id === assistantId
                      : userMsgId
                        ? m.parentId === userMsgId
                        : true),
                );

                if (assistantMsg) {
                  options?.onDone?.(assistantMsg.content);
                }
              } catch (err) {
                if (err instanceof Error && err.message.includes("Not Found")) {
                  // Chat was deleted concurrently; gracefully ignore
                } else {
                  logger.error("Failed to refetch chat on rejoin finish", err);
                }
              }
            }

            clearInflightState(chatId);
            setIsStreaming(false);
            setStreamingContent(null);
            setStreamingReasoning(null);
            setActiveToolCalls([]);
            setAssistantMessageId(null);
            break;
          }

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

            const toolResults = completedTools
              .filter((tc) => tc.result !== undefined)
              .map((tc) => ({
                toolCallId: tc.toolCallId,
                toolName: tc.toolName,
                result: tc.result,
              }));

            // A skill the model just wrote is not in the store, so the skills
            // screens would show a stale list until the next full hydration.
            if (extractSkillChangesFromToolResults(toolResults).length > 0) {
              void useAppStore.getState().loadSkills();
            }

            const metadata = JSON.stringify({
              model: pendingRef.current.model,
              reasoning,
              toolCalls: completedTools.map((tc) => ({
                toolCallId: tc.toolCallId,
                toolName: tc.toolName,
                args: tc.args,
              })),
              toolResults,
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

          clearInflightState(chatId);
          setIsStreaming(false);
          setStreamingContent(null);
          setStreamingReasoning(null);
          setActiveToolCalls([]);
          setAssistantMessageId(null);
          break;
        }

        case "error": {
          lastChunkTimeRef.current = 0;
          clearInflightState(chatId);
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

      if (event.type !== "finish" && event.type !== "error") {
        saveInflightState(chatId, {
          text: accumulatedTextRef.current,
          reasoning: accumulatedReasoningRef.current,
          toolCalls: activeToolCallsRef.current,
          assistantMessageId: assistantMessageIdRef.current,
        });
      }
    },
    [chatId, addMessage, upsertChat, handleApiError, options],
  );

  const fetchChatToken = useCallback(async () => {
    if (!chatId) throw new Error("No chatId");
    try {
      return await getChatRealtimeToken(chatId);
    } catch (err: any) {
      const msg = err?.message || "";
      if (
        msg.includes("Unauthorized") ||
        msg.includes("Not Found") ||
        msg.includes("access denied")
      ) {
        setChatNotFound(true);
        setIsStreaming(false);
        setStreamingContent(null);
        setStreamingReasoning(null);
        setActiveToolCalls([]);
      }
      throw err;
    }
  }, [chatId]);

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
    enabled: Boolean(chatId) && !chatNotFound,
    historyLimit: null,
    apiBaseUrl,
  });

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

  // biome-ignore lint/correctness/useExhaustiveDependencies: Reset pointer and streaming state on chatId change
  useEffect(() => {
    lastProcessedIndexRef.current = 0;
    rejoinedRef.current = false;
    pendingRef.current = { userMessageId: null, model: "", startTime: 0 };
    setIsStreaming(false);
    setStreamingContent(null);
    setStreamingReasoning(null);
    setActiveToolCalls([]);
    setChatNotFound(false);
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
    if (!isStreaming || chatNotFound) return;

    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      const timeSinceLastChunk = Date.now() - lastChunkTimeRef.current;
      const timeSinceStart = Date.now() - pendingRef.current.startTime;

      const hasActiveCallingTools = activeToolCallsRef.current.some(
        (t) => t.status === "calling",
      );

      const isConnectionError =
        connectionStatusRef.current === "error" || Boolean(realtimeError);
      const isRejoinedCheck =
        rejoinedRef.current && (attempts === 1 || timeSinceLastChunk > 2000);
      const isStalled =
        !hasActiveCallingTools &&
        timeSinceStart > 5000 &&
        timeSinceLastChunk > 5000;

      if (isConnectionError || isStalled || isRejoinedCheck) {
        const synced = await syncFromDb();
        if (synced) {
          clearInflightState(chatId);
          clearInterval(interval);
          return;
        }

        if (
          (isConnectionError && attempts >= 10) ||
          (!hasActiveCallingTools && attempts >= 30)
        ) {
          clearInflightState(chatId);
          clearInterval(interval);
          setIsStreaming(false);
          if (isConnectionError) {
            toast.error(
              "Connection lost to generation stream. Please refresh if response is ready.",
            );
          }
        }
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [isStreaming, chatNotFound, realtimeError, syncFromDb, chatId]);

  const isLoading = isStreaming;
  const isStreamingReasoning =
    isStreaming && !!streamingReasoning && !streamingContent;

  const stopStream = useCallback(() => {
    stoppedRef.current = true;
    clearInflightState(chatId);

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
    // If this hook instance rejoined a running stream, skip committing the partial tail.
    if (!rejoinedRef.current && partialText && userMsgId) {
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
    selectedPromptId?: string | string[],
    selectedAssistantId?: string,
    selectedKbIds: string[] = [],
    selectedSkillIds: string[] = [],
    subagentsEnabled?: boolean,
    subagentModelId?: string,
    subagentExcludedTools?: string[],
  ): Promise<string> => {
    const promptIds = Array.isArray(selectedPromptId)
      ? selectedPromptId
      : selectedPromptId
        ? [selectedPromptId]
        : [];

    rejoinedRef.current = false;
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
      subagentsEnabled,
      subagentModelId,
      subagentExcludedTools,
    );

    // 2. Resolve prompt content (MCP / slash-command)
    const { fullContent } = await resolveContent(
      content,
      promptIds,
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
      setIsStreaming(false);
      setStreamingContent(null);
      setStreamingReasoning(null);
      setActiveToolCalls([]);
      lastChunkTimeRef.current = 0;
      pendingRef.current = { userMessageId: null, model: "", startTime: 0 };
      assistantMessageIdRef.current = null;
      accumulatedTextRef.current = "";
      accumulatedReasoningRef.current = "";

      const isNotFound =
        err instanceof Error &&
        (err.message.includes("Not Found") ||
          err.message.includes("Unauthorized") ||
          err.message.includes("access denied"));

      if (isNotFound) {
        setChatNotFound(true);
        toast.error("Chat not found or has been deleted.");
      } else {
        toast.error("Failed to save message. Please check your connection.");
      }
      return "";
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
          selectedPromptIds: promptIds,
          selectedPromptId: promptIds[0],
          selectedSkillIds,
          selectedKbIds,
          subagentsEnabled,
          subagentModelId,
          subagentExcludedTools,
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
    assistantMessageId,
    streamResponse,
    stopStream,
  };
}
