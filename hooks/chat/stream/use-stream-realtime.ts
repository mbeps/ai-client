import { useRealtime } from "inngest/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { getChatRealtimeToken } from "@/actions/chats/chat-realtime-token";
import { isAccessOrNotFoundError } from "@/hooks/chat/stream/use-stream-db-sync";
import { type ChatStreamEvent, chatChannel } from "@/lib/inngest/chat-channel";
import { getRealtimeApiBaseUrl } from "@/lib/inngest/realtime-url";

/**
 * Processes a batch of incoming realtime messages, deduplicating against the processed set.
 * @author Maruf Bepary
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

/**
 * Hook subscribing to Inngest Realtime message batches and routing events to handler.
 * @author Maruf Bepary
 */
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

/**
 * Sets up Inngest Realtime channel subscription with token fetching and error handling.
 * @author Maruf Bepary
 */
export function useStreamRealtimeChannel(
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
