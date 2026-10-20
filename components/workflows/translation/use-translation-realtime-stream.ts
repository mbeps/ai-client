"use client";

import { useRealtime } from "inngest/react";
import { useCallback, useEffect, useMemo, useRef } from "react";
import { getTranslationRealtimeToken } from "@/actions/workflows/translate";
import {
  applyTranslationRealtimeEvent,
  type RealtimeTranslationEvent,
} from "@/components/workflows/translation/translation-helpers";
import { translationChannel } from "@/lib/inngest/channels";
import { getRealtimeApiBaseUrl } from "@/lib/inngest/realtime-url";

export interface UseTranslationRealtimeStreamParams {
  activeTranslationId: string | null;
  isLoading: boolean;
  setTranslatedText: React.Dispatch<React.SetStateAction<string>>;
  setIsLoading: (loading: boolean) => void;
}

function processNewRealtimeMessages(
  allMessages: readonly unknown[],
  lastIndex: number,
  setTranslatedText: React.Dispatch<React.SetStateAction<string>>,
  setIsLoading: (loading: boolean) => void,
): number {
  const startIndex = allMessages.length < lastIndex ? 0 : lastIndex;
  for (let i = startIndex; i < allMessages.length; i++) {
    const msg = allMessages[i] as
      | { data?: RealtimeTranslationEvent }
      | undefined;
    if (msg?.data) {
      applyTranslationRealtimeEvent(msg.data, setTranslatedText, setIsLoading);
    }
  }
  return allMessages.length;
}

/**
 * Manages the Inngest SSE realtime stream for background translation.
 */
export function useTranslationRealtimeStream(
  params: UseTranslationRealtimeStreamParams,
) {
  const { activeTranslationId, isLoading, setTranslatedText, setIsLoading } =
    params;
  const lastProcessedIndexRef = useRef(0);
  const apiBaseUrl = useMemo(() => getRealtimeApiBaseUrl(), []);

  const fetchTranslationToken = useCallback(async () => {
    if (!activeTranslationId) throw new Error("No active translation");
    return getTranslationRealtimeToken(activeTranslationId);
  }, [activeTranslationId]);

  const { messages } = useRealtime({
    channel: activeTranslationId
      ? translationChannel({ translationId: activeTranslationId })
      : undefined,
    topics: ["stream"] as const,
    token: fetchTranslationToken,
    enabled: Boolean(activeTranslationId && isLoading),
    historyLimit: null,
    apiBaseUrl,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: Reset pointer on translationId change
  useEffect(() => {
    lastProcessedIndexRef.current = 0;
  }, [activeTranslationId]);

  useEffect(() => {
    lastProcessedIndexRef.current = processNewRealtimeMessages(
      messages.all,
      lastProcessedIndexRef.current,
      setTranslatedText,
      setIsLoading,
    );
  }, [messages.all, setTranslatedText, setIsLoading]);
}

