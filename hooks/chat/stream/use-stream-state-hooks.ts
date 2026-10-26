import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isChatGenerating } from "@/actions/chats/is-chat-generating";
import {
  clearInflightState,
  restoreCachedStreamState,
} from "@/hooks/chat/stream/use-stream-inflight-state";
import type {
  CachedStreamStateSetters,
  PendingRefState,
  StreamRefsObject,
} from "@/hooks/chat/stream/use-stream-types";
import { useAppStore } from "@/lib/store/use-app-store";
import type { Chat } from "@/types/chat/chat";
import type { Message } from "@/types/message/message";
import type { ToolCallState } from "@/types/tool/tool-call";

/**
 * Accesses chat slice actions and selectors from global AppStore.
 *
 * @param chatId - Active chat ID
 * @returns Store message actions and current chat object
 * @author Maruf Bepary
 */
export function useStreamStore(chatId: string) {
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

/**
 * Encapsulates reactive streaming state (text, reasoning, tool calls, IDs, errors).
 *
 * @author Maruf Bepary
 */
export function useStreamState() {
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

/**
 * Manages mutable refs holding fast-updating stream values without causing rerenders.
 *
 * @author Maruf Bepary
 */
export function useStreamRefs(): StreamRefsObject {
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

/**
 * Checks if the chat is actively generating on the server upon component mount.
 *
 * @param params - Mount check parameters including chat ID, leaf message ID, refs, and setters
 * @author Maruf Bepary
 */
async function executeMountRejoinCheck(params: {
  chatId: string;
  leafId: string;
  refs: StreamRefsObject;
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

/**
 * Effect checking whether an uncompleted user turn is still generating on page load / navigation.
 *
 * @param chatId - Active chat identifier
 * @param currentChat - Chat object from local store
 * @param activeLeaf - Latest message node in active thread
 * @param isStreaming - Flag indicating active streaming
 * @param syncFromDb - Function to sync chat from database
 * @param refs - Mutable stream refs bundle
 * @param setters - Stream state setters
 * @author Maruf Bepary
 */
export function useStreamMountRejoin(
  chatId: string,
  currentChat: Chat | undefined,
  activeLeaf: Message | undefined,
  isStreaming: boolean,
  syncFromDb: () => Promise<boolean>,
  refs: StreamRefsObject,
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
