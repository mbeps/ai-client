import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { isChatGenerating } from "@/actions/chats/is-chat-generating";
import { clearInflightState } from "@/hooks/chat/stream/use-stream-inflight-state";
import type { StreamRefsObject } from "@/hooks/chat/stream/use-stream-types";
import { logger } from "@/lib/logger";

/**
 * Evaluates whether stream conditions warrant triggering a database sync.
 *
 * @param params - Health evaluation metrics including error flags, rejoin state, and timeouts
 * @returns True if database sync should be attempted
 * @author Maruf Bepary
 */
function shouldTriggerWatchdogSync(params: {
  isConnectionError: boolean;
  isRejoined: boolean;
  attempts: number;
  timeSinceLastChunk: number;
  timeSinceStart: number;
  hasActiveCallingTools: boolean;
  isAwaitingApproval: boolean;
}): boolean {
  if (params.isConnectionError) return true;
  if (
    params.isRejoined &&
    (params.attempts === 1 || params.timeSinceLastChunk > 2000)
  ) {
    return true;
  }
  return (
    (!params.hasActiveCallingTools || params.isAwaitingApproval) &&
    params.timeSinceStart > 5000 &&
    params.timeSinceLastChunk > 5000
  );
}

/**
 * Determines whether to abort a stalled stream after excessive attempts.
 *
 * @param params - Failure evaluation state
 * @returns True if stalled stream should be aborted
 * @author Maruf Bepary
 */
function shouldAbortStalledWatchdog(params: {
  isConnectionError: boolean;
  hasActiveCallingTools: boolean;
  isAwaitingApproval: boolean;
  attempts: number;
  noChunkAttempts: number;
  hasReceivedAnyChunk: boolean;
}): boolean {
  if (params.isAwaitingApproval) return false;
  if (params.isConnectionError && params.attempts >= 10) return true;
  if (!params.hasReceivedAnyChunk && params.noChunkAttempts >= 4) return true;
  return !params.hasActiveCallingTools && params.attempts >= 30;
}

/**
 * Executes a single watchdog interval tick, attempting recovery or halting stalled generation.
 *
 * @param params - Watchdog tick context including interval timer, sync handlers, and counters
 * @author Maruf Bepary
 */
async function executeWatchdogTick(params: {
  chatId: string;
  interval: ReturnType<typeof setInterval>;
  syncFromDb: () => Promise<boolean>;
  setIsStreaming: (is: boolean) => void;
  getStatus: () => ReturnType<typeof createWatchdogTickStatus>;
  attempts: number;
  noChunkAttempts: number;
}) {
  const initialTick = params.getStatus();
  if (!initialTick.shouldSync) return;

  const synced = await params.syncFromDb();
  if (synced) {
    clearInflightState(params.chatId);
    clearInterval(params.interval);
    return;
  }

  // Re-read live refs after syncFromDb() resolves in case approval or chunks arrived mid-await
  const liveTick = params.getStatus();

  if (
    shouldAbortStalledWatchdog({
      isConnectionError: liveTick.isConnectionError,
      hasActiveCallingTools: liveTick.hasActiveCallingTools,
      isAwaitingApproval: liveTick.isAwaitingApproval,
      hasReceivedAnyChunk: liveTick.hasReceivedAnyChunk,
      attempts: params.attempts,
      noChunkAttempts: params.noChunkAttempts,
    })
  ) {
    if (!liveTick.isConnectionError) {
      const res = await isChatGenerating(params.chatId);
      const isGenerating = res.ok ? res.value : false;
      if (isGenerating) return;
    }

    clearInflightState(params.chatId);
    clearInterval(params.interval);
    params.setIsStreaming(false);
    if (liveTick.isConnectionError) {
      toast.error(
        "Connection lost to generation stream. Please refresh if response is ready.",
      );
    }
  }
}

/**
 * Computes watchdog health status from refs and connection flags.
 *
 * @param refs - Mutable stream refs bundle
 * @param connectionStatus - Realtime connection status string
 * @param realtimeError - Error thrown by Realtime subscription
 * @param attempts - Elapsed polling tick count
 * @returns Watchdog tick health indicators
 * @author Maruf Bepary
 */
function createWatchdogTickStatus(
  refs: StreamRefsObject,
  connectionStatus: string,
  realtimeError: unknown,
  attempts: number,
) {
  const isAwaitingApproval = Boolean(refs.awaitingApprovalRef?.current);
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
    isAwaitingApproval,
  });

  const hasReceivedAnyChunk =
    refs.lastChunkTimeRef.current > refs.pendingRef.current.startTime ||
    Boolean(refs.assistantMessageIdRef.current) ||
    refs.accumulatedTextRef.current.length > 0 ||
    refs.accumulatedReasoningRef.current.length > 0 ||
    refs.activeToolCallsRef.current.length > 0;

  return {
    isConnectionError,
    hasActiveCallingTools,
    isAwaitingApproval,
    hasReceivedAnyChunk,
    shouldSync,
  };
}

/**
 * Watchdog hook polling connection and generation health during streaming.
 *
 * @param chatId - Active chat ID
 * @param isStreaming - Flag indicating active generation
 * @param chatNotFound - Flag indicating chat was deleted
 * @param connectionStatus - Inngest Realtime subscription status
 * @param realtimeError - Error thrown by Realtime subscription
 * @param syncFromDb - Function to sync latest chat messages from DB
 * @param setIsStreaming - Setter controlling active streaming state
 * @param refs - Mutable stream refs bundle
 * @author Maruf Bepary
 */
export function useStreamWatchdog(
  chatId: string,
  isStreaming: boolean,
  chatNotFound: boolean,
  connectionStatus: string,
  realtimeError: unknown,
  syncFromDb: () => Promise<boolean>,
  setIsStreaming: (is: boolean) => void,
  refs: StreamRefsObject,
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
    let noChunkAttempts = 0;
    const interval = setInterval(async () => {
      attempts++;
      if (refs.pendingRef.current.dispatched !== false) {
        noChunkAttempts++;
      }

      await executeWatchdogTick({
        chatId,
        interval,
        syncFromDb,
        setIsStreaming,
        getStatus: () =>
          createWatchdogTickStatus(
            refs,
            connectionStatusRef.current,
            realtimeError,
            attempts,
          ),
        attempts,
        noChunkAttempts,
      });
    }, 2000);

    return () => clearInterval(interval);
  }, [isStreaming, chatNotFound, realtimeError, syncFromDb, chatId]);
}
