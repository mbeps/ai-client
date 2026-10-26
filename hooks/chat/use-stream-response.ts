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
import {
  accumulateReasoningDelta,
  accumulateTextDelta,
} from "@/lib/chat/stream/accumulate-stream-chunks";
import { applyToolResultEvent } from "@/lib/chat/stream/apply-tool-result-event";
import { buildAssistantFinishMetadata } from "@/lib/chat/stream/build-assistant-finish-metadata";
import { extractCompletedToolResults } from "@/lib/chat/stream/extract-completed-tool-results";
import { applyToolCallEvent } from "@/lib/chat/stream/handle-stream-tool-calls";
import { type ChatStreamEvent, chatChannel } from "@/lib/inngest/chat-channel";
import { getRealtimeApiBaseUrl } from "@/lib/inngest/realtime-url";
import { logger } from "@/lib/logger";
import { useAppStore } from "@/lib/store";
import type { Attachment } from "@/types/attachment/attachment";
import type { Chat } from "@/types/chat/chat";
import type { Message } from "@/types/message/message";
import type { ToolCallState } from "@/types/tool/tool-call";

const ACCESS_OR_NOT_FOUND_PATTERNS = [
  "Not Found",
  "Unauthorized",
  "access denied",
] as const;

interface BuildMetadataOptions {
  model: string;
  selectedServerIds: string[];
  selectedTools: string[];
  selectedAssistantId?: string;
  selectedKbIds?: string[];
  selectedSkillIds?: string[];
  subagentsEnabled?: boolean;
  subagentModelId?: string;
}

interface CachedStreamStateRefs {
  accumulatedTextRef: { current: string };
  accumulatedReasoningRef: { current: string };
  activeToolCallsRef: { current: ToolCallState[] };
  assistantMessageIdRef: { current: string | null };
}

interface CachedStreamStateSetters {
  setStreamingContent: (text: string | null) => void;
  setStreamingReasoning: (reasoning: string | null) => void;
  setActiveToolCalls: (calls: ToolCallState[]) => void;
  setAssistantMessageId: (id: string | null) => void;
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
  subagentsEnabled?: boolean;
  subagentModelId?: string;
}

interface StreamDeltaRefs {
  lastChunkTimeRef: { current: number };
  assistantMessageIdRef: { current: string | null };
  accumulatedTextRef: { current: string };
  accumulatedReasoningRef: { current: string };
  activeToolCallsRef: { current: ToolCallState[] };
}

interface StreamDeltaSetters {
  setAssistantMessageId: (id: string | null) => void;
  setStreamingContent: (text: string | null) => void;
  setStreamingReasoning: (reasoning: string | null) => void;
  setActiveToolCalls: (calls: ToolCallState[]) => void;
  setIsStreaming: (is: boolean) => void;
}

interface PendingRefState {
  userMessageId: string | null;
  model: string;
  startTime: number;
}

interface StreamResponseExecutionParams {
  chatId: string;
  userMsgId: string;
  content: string;
  parentId: string | null;
  attachments: Attachment[];
  model: string;
  selectedServerIds: string[];
  selectedTools: string[];
  selectedPromptIds: string[];
  selectedAssistantId?: string;
  selectedKbIds: string[];
  selectedSkillIds: string[];
  subagentsEnabled?: boolean;
  subagentModelId?: string;
  addMessage: ReturnType<typeof useStreamStore>["addMessage"];
  updateMessageAttachments: ReturnType<
    typeof useStreamStore
  >["updateMessageAttachments"];
  handleApiError: (err: unknown) => boolean;
  resetStreamingState: () => void;
  setIsStreaming: (is: boolean) => void;
  setChatNotFound: (notFound: boolean) => void;
  refs: ReturnType<typeof useStreamRefs>;
}

/**
 * Builds the metadata object for the user message, tracking model, tools, and prompt info.
 * @author Maruf Bepary
 */
function buildMetadata(options: BuildMetadataOptions): Record<string, unknown> {
  const metadataObj: Record<string, unknown> = {
    model: options.model,
    selectedServerIds: options.selectedServerIds,
    selectedTools: options.selectedTools,
  };

  const stringEntries: [string, string | undefined][] = [
    ["assistantId", options.selectedAssistantId],
    ["subagentModelId", options.subagentModelId],
  ];
  for (const [key, val] of stringEntries) {
    if (val) metadataObj[key] = val;
  }

  const listEntries: [string, string[] | undefined][] = [
    ["selectedKbIds", options.selectedKbIds],
    ["selectedSkillIds", options.selectedSkillIds],
  ];
  for (const [key, list] of listEntries) {
    if (list && list.length > 0) metadataObj[key] = list;
  }

  if (options.subagentsEnabled !== undefined) {
    metadataObj.subagentsEnabled = options.subagentsEnabled;
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
  try {
    sessionStorage.setItem(`chat_inflight_${chatId}`, JSON.stringify(state));
  } catch {}
}

function loadInflightState(chatId: string) {
  try {
    const raw = sessionStorage.getItem(`chat_inflight_${chatId}`);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function clearInflightState(chatId: string) {
  try {
    sessionStorage.removeItem(`chat_inflight_${chatId}`);
  } catch {}
}

/**
 * Restores in-flight state from sessionStorage when rejoining an active chat stream.
 */
function restoreCachedStreamState(
  chatId: string,
  refs: CachedStreamStateRefs,
  setters: CachedStreamStateSetters,
) {
  const cached = loadInflightState(chatId);
  if (!cached) return;

  if (cached.text) {
    refs.accumulatedTextRef.current = cached.text;
    setters.setStreamingContent(cached.text);
  }
  if (cached.reasoning) {
    refs.accumulatedReasoningRef.current = cached.reasoning;
    setters.setStreamingReasoning(cached.reasoning);
  }
  if (Array.isArray(cached.toolCalls) && cached.toolCalls.length > 0) {
    refs.activeToolCallsRef.current = cached.toolCalls;
    setters.setActiveToolCalls(cached.toolCalls);
  }
  if (cached.assistantMessageId) {
    refs.assistantMessageIdRef.current = cached.assistantMessageId;
    setters.setAssistantMessageId(cached.assistantMessageId);
  }
}

/**
 * Processes a batch of incoming realtime messages, deduplicating against the processed set.
 */
function processIncomingRealtimeBatch(
  batch: Array<{ data?: unknown } | unknown>,
  processedSet: WeakSet<object>,
  onEvent: (event: ChatStreamEvent) => void,
) {
  for (const msg of batch) {
    if (msg && typeof msg === "object" && !processedSet.has(msg)) {
      processedSet.add(msg);
      const data = (msg as { data?: unknown }).data;
      if (data) {
        onEvent(data as ChatStreamEvent);
      }
    }
  }
}

function isAccessOrNotFoundError(err: unknown): boolean {
  if (!err) return false;
  const message =
    err instanceof Error
      ? err.message
      : typeof err === "object" && "message" in err
        ? String((err as { message: unknown }).message)
        : "";
  return ACCESS_OR_NOT_FOUND_PATTERNS.some((pattern) =>
    message.includes(pattern),
  );
}

function findMatchingAssistantMessage(
  messages: Array<{
    id: string;
    role: string;
    parentId?: string | null;
    content: string;
  }>,
  assistantId: string | null,
  targetParentId?: string | null,
) {
  return messages.find((m) => {
    if (m.role !== "assistant") return false;
    if (assistantId) return m.id === assistantId;
    if (targetParentId) return m.parentId === targetParentId;
    return true;
  });
}

async function resolveSinglePromptChunk(
  promptId: string,
  prompts: Array<{ id: string; content?: string }>,
): Promise<string | undefined> {
  if (promptId.startsWith("mcp:")) {
    const parts = promptId.split(":");
    const serverId = parts[1];
    const promptName = parts.slice(2).join(":");
    try {
      return await resolveMcpPrompt(serverId, promptName);
    } catch (err) {
      logger.error("Failed to load MCP prompt", err);
      toast.error("Failed to load MCP prompt. Sending message without it.");
      return undefined;
    }
  }
  const local = prompts.find((p) => p.id === promptId);
  return local?.content || undefined;
}

/**
 * Resolves the final message content by handling MCP prompts and slash-command prompts.
 * @author Maruf Bepary
 */
async function resolveContent(
  content: string,
  selectedPromptIds: string[] = [],
  metadataObj: Record<string, unknown> = {},
): Promise<{ fullContent: string }> {
  const meta = metadataObj;
  if (selectedPromptIds.length === 0) return { fullContent: content };

  const promptChunks: string[] = [];
  const prompts = useAppStore.getState().prompts;

  for (const promptId of selectedPromptIds) {
    const chunk = await resolveSinglePromptChunk(promptId, prompts);
    if (chunk) promptChunks.push(chunk);
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

function shouldTriggerWatchdogSync(params: {
  isConnectionError: boolean;
  isRejoined: boolean;
  attempts: number;
  timeSinceLastChunk: number;
  timeSinceStart: number;
  hasActiveCallingTools: boolean;
}): boolean {
  if (params.isConnectionError) return true;
  if (
    params.isRejoined &&
    (params.attempts === 1 || params.timeSinceLastChunk > 2000)
  ) {
    return true;
  }
  return (
    !params.hasActiveCallingTools &&
    params.timeSinceStart > 5000 &&
    params.timeSinceLastChunk > 5000
  );
}

function shouldAbortStalledWatchdog(params: {
  isConnectionError: boolean;
  hasActiveCallingTools: boolean;
  attempts: number;
}): boolean {
  if (params.isConnectionError && params.attempts >= 10) return true;
  return !params.hasActiveCallingTools && params.attempts >= 30;
}

function applyStreamDelta(
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

function resolveUserMessageIdForStop(
  pendingUserMsgId: string | null,
  currentChat?: {
    currentLeafId?: string | null;
    messages: Record<string, { role: string }>;
  },
): string | null {
  if (pendingUserMsgId) return pendingUserMsgId;
  const leafId = currentChat?.currentLeafId;
  if (leafId && currentChat.messages[leafId]?.role === "user") {
    return leafId;
  }
  return null;
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err) {
    return String((err as { message: unknown }).message);
  }
  return "";
}

async function dispatchChatStreamRequest(
  body: StreamRequestOptions,
  handleApiError: (err: unknown) => boolean,
): Promise<boolean> {
  try {
    const res = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errorData = await res.json().catch(() => ({}));
      if (!handleApiError(errorData)) {
        toast.error(errorData.error || "Failed to generate response");
      }
      return false;
    }
    return true;
  } catch (err: unknown) {
    if (!handleApiError(err)) {
      const message = extractErrorMessage(err);
      toast.error(message || "Failed to generate response");
    }
    return false;
  }
}

async function persistUserTurnMessage(
  chatId: string,
  userMsgId: string,
  fullContent: string,
  parentId: string | null,
  metadata: string,
): Promise<{ success: boolean; isNotFound: boolean }> {
  try {
    await persistMessage(chatId, {
      id: userMsgId,
      role: "user",
      content: fullContent,
      parentId,
      metadata,
    });
    return { success: true, isNotFound: false };
  } catch (err) {
    logger.error("Failed to persist message", err);
    return {
      success: false,
      isNotFound: isAccessOrNotFoundError(err),
    };
  }
}

function isChatInStore(chatId: string): boolean {
  if (!chatId) return false;
  const chats = useAppStore.getState().chats;
  return Boolean(chats?.[chatId]);
}

function hasValidSyncTarget(
  assistantId: string | null,
  targetParentId?: string,
): boolean {
  if (assistantId) return true;
  return Boolean(targetParentId);
}

function handleSyncError(
  err: unknown,
  setChatNotFound: (notFound: boolean) => void,
  resetStreamingState: () => void,
) {
  if (isAccessOrNotFoundError(err)) {
    setChatNotFound(true);
    resetStreamingState();
    return;
  }
  logger.error("Failed to sync chat from DB", err);
}

function applySyncedAssistantMessage(
  chatId: string,
  data: Parameters<typeof buildChatFromRows>[0],
  assistantMsg: { content: string },
  upsertChat: (chat: Chat) => void,
  onDone?: (content: string) => void,
) {
  clearInflightState(chatId);
  const fullChat = buildChatFromRows(data);
  upsertChat(fullChat);
  if (onDone) {
    onDone(assistantMsg.content);
  }
}

function resolveSyncTargetParentId(
  userMsgId: string | null,
  activeLeaf?: { id: string },
): string | undefined {
  if (userMsgId) return userMsgId;
  return activeLeaf ? activeLeaf.id : undefined;
}

function useStreamStore(chatId: string) {
  const addMessage = useAppStore((state) => state.addMessage);
  const upsertChat = useAppStore((state) => state.upsertChat);
  const updateMessageAttachments = useAppStore(
    (state) => state.updateMessageAttachments,
  );
  const currentChat = useAppStore((state) =>
    chatId ? state.chats?.[chatId] : undefined,
  );
  return { addMessage, upsertChat, updateMessageAttachments, currentChat };
}

function useStreamState() {
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

  const resetStreamingState = useCallback(() => {
    setIsStreaming(false);
    setStreamingContent(null);
    setStreamingReasoning(null);
    setActiveToolCalls([]);
    setAssistantMessageId(null);
  }, []);

  return {
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
  };
}

function useStreamRefs() {
  const pendingRef = useRef<PendingRefState>({
    userMessageId: null,
    model: "",
    startTime: 0,
  });
  const lastChunkTimeRef = useRef(0);
  const accumulatedTextRef = useRef("");
  const accumulatedReasoningRef = useRef("");
  const assistantMessageIdRef = useRef<string | null>(null);
  const activeToolCallsRef = useRef<ToolCallState[]>([]);
  const stoppedRef = useRef(false);
  const rejoinedRef = useRef(false);
  const checkedChatIdRef = useRef<string | null>(null);

  return useMemo(
    () => ({
      pendingRef,
      lastChunkTimeRef,
      accumulatedTextRef,
      accumulatedReasoningRef,
      assistantMessageIdRef,
      activeToolCallsRef,
      stoppedRef,
      rejoinedRef,
      checkedChatIdRef,
    }),
    [],
  );
}

async function executeMountRejoinCheck(params: {
  chatId: string;
  leafId: string;
  refs: ReturnType<typeof useStreamRefs>;
  setters: CachedStreamStateSetters & { setIsStreaming: (is: boolean) => void };
  syncFromDb: () => Promise<boolean>;
}) {
  try {
    const generating = await isChatGenerating(params.chatId);
    if (generating) {
      params.refs.rejoinedRef.current = true;
      params.refs.pendingRef.current = {
        userMessageId: params.leafId,
        model: "",
        startTime: Date.now(),
      };
      params.refs.lastChunkTimeRef.current = Date.now();

      restoreCachedStreamState(params.chatId, params.refs, params.setters);
      params.setters.setIsStreaming(true);
    } else {
      clearInflightState(params.chatId);
      await params.syncFromDb();
    }
  } catch {}
}

function useStreamMountRejoin(
  chatId: string,
  currentChat: Chat | undefined,
  activeLeaf: Message | undefined,
  isStreaming: boolean,
  syncFromDb: () => Promise<boolean>,
  refs: ReturnType<typeof useStreamRefs>,
  setters: CachedStreamStateSetters & { setIsStreaming: (is: boolean) => void },
) {
  // biome-ignore lint/correctness/useExhaustiveDependencies: mount effect only responds to chat and streaming lifecycle changes
  useEffect(() => {
    if (!chatId) return;
    if (refs.checkedChatIdRef.current === chatId) return;
    if (isStreaming || refs.pendingRef.current.userMessageId !== null) return;
    if (!currentChat) return;

    if (activeLeaf?.role !== "user") {
      refs.checkedChatIdRef.current = chatId;
      return;
    }

    refs.checkedChatIdRef.current = chatId;
    const leafId = activeLeaf.id;

    void executeMountRejoinCheck({
      chatId,
      leafId,
      refs,
      setters,
      syncFromDb,
    });
  }, [chatId, currentChat, activeLeaf, isStreaming, syncFromDb]);
}

async function executeWatchdogTick(params: {
  chatId: string;
  interval: ReturnType<typeof setInterval>;
  syncFromDb: () => Promise<boolean>;
  setIsStreaming: (is: boolean) => void;
  isConnectionError: boolean;
  hasActiveCallingTools: boolean;
  attempts: number;
  shouldSync: boolean;
}) {
  if (!params.shouldSync) return;

  const synced = await params.syncFromDb();
  if (synced) {
    clearInflightState(params.chatId);
    clearInterval(params.interval);
    return;
  }

  if (
    shouldAbortStalledWatchdog({
      isConnectionError: params.isConnectionError,
      hasActiveCallingTools: params.hasActiveCallingTools,
      attempts: params.attempts,
    })
  ) {
    clearInflightState(params.chatId);
    clearInterval(params.interval);
    params.setIsStreaming(false);
    if (params.isConnectionError) {
      toast.error(
        "Connection lost to generation stream. Please refresh if response is ready.",
      );
    }
  }
}

function createWatchdogTickStatus(
  refs: ReturnType<typeof useStreamRefs>,
  connectionStatus: string,
  realtimeError: unknown,
  attempts: number,
) {
  const timeSinceLastChunk = Date.now() - refs.lastChunkTimeRef.current;
  const timeSinceStart = Date.now() - refs.pendingRef.current.startTime;
  const hasActiveCallingTools = refs.activeToolCallsRef.current.some(
    (t) => t.status === "calling",
  );
  const isConnectionError =
    connectionStatus === "error" || Boolean(realtimeError);

  const shouldSync = shouldTriggerWatchdogSync({
    isConnectionError,
    isRejoined: refs.rejoinedRef.current,
    attempts,
    timeSinceLastChunk,
    timeSinceStart,
    hasActiveCallingTools,
  });

  return { isConnectionError, hasActiveCallingTools, shouldSync };
}

function useStreamWatchdog(
  chatId: string,
  isStreaming: boolean,
  chatNotFound: boolean,
  connectionStatus: string,
  realtimeError: unknown,
  syncFromDb: () => Promise<boolean>,
  setIsStreaming: (is: boolean) => void,
  refs: ReturnType<typeof useStreamRefs>,
) {
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

  // biome-ignore lint/correctness/useExhaustiveDependencies: watchdog responds only to stream status and connection changes
  useEffect(() => {
    if (!isStreaming || chatNotFound) return;

    let attempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      const tick = createWatchdogTickStatus(
        refs,
        connectionStatusRef.current,
        realtimeError,
        attempts,
      );

      await executeWatchdogTick({
        chatId,
        interval,
        syncFromDb,
        setIsStreaming,
        isConnectionError: tick.isConnectionError,
        hasActiveCallingTools: tick.hasActiveCallingTools,
        attempts,
        shouldSync: tick.shouldSync,
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isStreaming, chatNotFound, realtimeError, syncFromDb, chatId]);
}

function useStreamRealtimeIngestion(
  chatId: string,
  messages: {
    all?: Array<{ data?: unknown }>;
    delta?: Array<{ data?: unknown }>;
  },
  handleStreamEvent: (event: ChatStreamEvent) => void,
) {
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
        processIncomingRealtimeBatch(
          all.slice(lastProcessedIndexRef.current),
          processedMessagesRef.current,
          handleStreamEvent,
        );
        lastProcessedIndexRef.current = all.length;
      }
      return;
    }

    if (messages.delta && messages.delta.length > 0) {
      processIncomingRealtimeBatch(
        messages.delta,
        processedMessagesRef.current,
        handleStreamEvent,
      );
    }
  }, [messages.all, messages.delta, handleStreamEvent]);
}

function useStreamRealtimeChannel(
  chatId: string,
  chatNotFound: boolean,
  setChatNotFound: (notFound: boolean) => void,
  resetStreamingState: () => void,
  handleStreamEvent: (event: ChatStreamEvent) => void,
) {
  const fetchChatToken = useCallback(async () => {
    if (!chatId) throw new Error("No chatId");
    try {
      return await getChatRealtimeToken(chatId);
    } catch (err: unknown) {
      if (isAccessOrNotFoundError(err)) {
        setChatNotFound(true);
        resetStreamingState();
      }
      throw err;
    }
  }, [chatId, resetStreamingState, setChatNotFound]);

  const apiBaseUrl = useMemo(() => getRealtimeApiBaseUrl(), []);

  const realtime = useRealtime({
    channel: chatId ? chatChannel({ chatId }) : undefined,
    topics: ["stream"] as const,
    token: fetchChatToken,
    enabled: Boolean(chatId) && !chatNotFound,
    historyLimit: null,
    apiBaseUrl,
  });

  useStreamRealtimeIngestion(chatId, realtime.messages, handleStreamEvent);

  return realtime;
}

async function executeRejoinFinish(
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
    if (isAccessOrNotFoundError(err)) {
      // Chat was deleted concurrently; gracefully ignore
    } else {
      logger.error("Failed to refetch chat on rejoin finish", err);
    }
  }
}

function executeStandardFinish(params: {
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

function useStreamEventHandlers(params: {
  chatId: string;
  options?: { onDone?: (content: string) => void };
  upsertChat: (chat: Chat) => void;
  addMessage: (chatId: string, msg: any) => void;
  handleApiError: (err: unknown) => boolean;
  resetStreamingState: () => void;
  streamRefs: ReturnType<typeof useStreamRefs>;
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

function executeStopStream(
  chatId: string,
  addMessage: (chatId: string, msg: any) => void,
  resetStreamingState: () => void,
  refs: ReturnType<typeof useStreamRefs>,
) {
  refs.stoppedRef.current = true;
  clearInflightState(chatId);

  const partialText = refs.accumulatedTextRef.current;
  const messageId = refs.assistantMessageIdRef.current || crypto.randomUUID();
  const chat = useAppStore.getState().chats?.[chatId];
  const userMsgId = resolveUserMessageIdForStop(
    refs.pendingRef.current.userMessageId,
    chat,
  );

  if (!refs.rejoinedRef.current && partialText && userMsgId) {
    const stopMetadata = JSON.stringify({
      model: refs.pendingRef.current.model,
      finishReason: "stop",
    });
    addMessage(chatId, {
      role: "assistant",
      content: partialText,
      parentId: userMsgId,
      id: messageId,
      metadata: stopMetadata,
    });
    persistMessage(chatId, {
      id: messageId,
      role: "assistant",
      content: partialText,
      parentId: userMsgId,
      metadata: stopMetadata,
    }).catch((err) => {
      logger.error("Failed to persist stopped message", err);
    });
  }

  refs.lastChunkTimeRef.current = 0;
  resetStreamingState();
  fetch("/api/chat/stop", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chatId }),
  }).catch(() => {});
}

function setupStreamResponseStart(
  refs: ReturnType<typeof useStreamRefs>,
  resetStreamingState: () => void,
  setIsStreaming: (is: boolean) => void,
  userMsgId: string,
  model: string,
) {
  refs.rejoinedRef.current = false;
  refs.pendingRef.current = {
    userMessageId: userMsgId,
    model,
    startTime: Date.now(),
  };
  refs.lastChunkTimeRef.current = Date.now();
  refs.stoppedRef.current = false;
  refs.assistantMessageIdRef.current = null;
  refs.accumulatedTextRef.current = "";
  refs.accumulatedReasoningRef.current = "";
  refs.activeToolCallsRef.current = [];
  resetStreamingState();
  setIsStreaming(true);
}

function handlePersistFailure(
  refs: ReturnType<typeof useStreamRefs>,
  resetStreamingState: () => void,
  setChatNotFound: (v: boolean) => void,
  isNotFound: boolean,
) {
  resetStreamingState();
  refs.lastChunkTimeRef.current = 0;
  refs.pendingRef.current = { userMessageId: null, model: "", startTime: 0 };
  refs.assistantMessageIdRef.current = null;
  refs.accumulatedTextRef.current = "";
  refs.accumulatedReasoningRef.current = "";

  if (isNotFound) {
    setChatNotFound(true);
    toast.error("Chat not found or has been deleted.");
  } else {
    toast.error("Failed to save message. Please check your connection.");
  }
}

async function prepareAndPersistUserMessage(
  params: StreamResponseExecutionParams,
): Promise<{
  userMsgMetadata: string;
  persisted: boolean;
  isNotFound: boolean;
}> {
  const metadataObj = buildMetadata(params);
  const { fullContent } = await resolveContent(
    params.content,
    params.selectedPromptIds,
    metadataObj,
  );
  const userMsgMetadata = JSON.stringify(metadataObj);

  params.addMessage(params.chatId, {
    role: "user",
    content: fullContent,
    parentId: params.parentId,
    id: params.userMsgId,
    metadata: userMsgMetadata,
    attachments: params.attachments,
  });

  const res = await persistUserTurnMessage(
    params.chatId,
    params.userMsgId,
    fullContent,
    params.parentId,
    userMsgMetadata,
  );

  return {
    userMsgMetadata,
    persisted: res.success,
    isNotFound: res.isNotFound,
  };
}

async function executeStreamResponse(
  params: StreamResponseExecutionParams,
): Promise<string> {
  setupStreamResponseStart(
    params.refs,
    params.resetStreamingState,
    params.setIsStreaming,
    params.userMsgId,
    params.model,
  );

  const { persisted, isNotFound } = await prepareAndPersistUserMessage(params);

  if (!persisted) {
    handlePersistFailure(
      params.refs,
      params.resetStreamingState,
      params.setChatNotFound,
      isNotFound,
    );
    return "";
  }

  const uploaded = await processAttachments(
    params.attachments,
    params.userMsgId,
  );
  if (uploaded.length > 0) {
    params.updateMessageAttachments(params.chatId, params.userMsgId, uploaded);
  }

  const dispatched = await dispatchChatStreamRequest(
    {
      chatId: params.chatId,
      userMessageId: params.userMsgId,
      model: params.model,
      selectedServerIds: params.selectedServerIds,
      selectedTools: params.selectedTools,
      selectedAssistantId: params.selectedAssistantId,
      selectedSkillIds: params.selectedSkillIds,
      selectedKbIds: params.selectedKbIds,
      subagentsEnabled: params.subagentsEnabled,
      subagentModelId: params.subagentModelId,
    },
    params.handleApiError,
  );

  if (!dispatched) {
    params.setIsStreaming(false);
  }

  return "";
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

  const stopStream = useCallback(() => {
    executeStopStream(chatId, addMessage, resetStreamingState, streamRefs);
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
