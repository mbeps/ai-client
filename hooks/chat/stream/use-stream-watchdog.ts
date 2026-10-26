import { useEffect, useRef } from "react";
import { toast } from "sonner";
import { clearInflightState } from "@/hooks/chat/stream/use-stream-inflight-state";
import type { StreamRefsObject } from "@/hooks/chat/stream/use-stream-types";
import { logger } from "@/lib/logger";

/**
 * Evaluates whether stream conditions warrant triggering a database sync.
 * @author Maruf Bepary
 */
export function shouldTriggerWatchdogSync(params: {
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

/**
 * Determines whether to abort a stalled stream after excessive attempts.
 * @author Maruf Bepary
 */
export function shouldAbortStalledWatchdog(params: {
  isConnectionError: boolean;
  hasActiveCallingTools: boolean;
  attempts: number;
}): boolean {
  if (params.isConnectionError && params.attempts >= 10) return true;
  return !params.hasActiveCallingTools && params.attempts >= 30;
}

/**
 * Executes a single watchdog interval tick, attempting recovery or halting stalled generation.
 * @author Maruf Bepary
 */
export async function executeWatchdogTick(params: {
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

/**
 * Computes watchdog health status from refs and connection flags.
 * @author Maruf Bepary
 */
export function createWatchdogTickStatus(
  refs: StreamRefsObject,
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

/**
 * Watchdog hook polling connection and generation health during streaming.
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
