import { useRealtime } from "inngest/react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { getTransformRunRealtimeToken } from "@/actions/transform-runs/get-transform-run-realtime-token";
import { startTransformRunAction } from "@/actions/transform-runs/start-transform-run";
import {
  applyReviewRequiredToStep,
  applyStepCompleteToStep,
  applyStepStartEvent,
  applyToolCallToStep,
  applyToolResultToStep,
} from "@/components/workflows/transform-run/state-helpers";
import { useApiError } from "@/hooks/use-api-error";
import { getRealtimeApiBaseUrl } from "@/lib/inngest/realtime-url";
import { transformRunChannel } from "@/lib/inngest/transform-run-channel";
import type { ArtifactData } from "@/types/artifact/artifact-data";
import type { TransformAgent } from "@/types/transform/transform-agent";
import type { TransformRun } from "@/types/transform/transform-run";
import type { StepState } from "@/types/workflows/transform-run";

/**
 * Performs handle step start event.
 *
 * @param event - Target event
 * @param activeStepIndexRef - Target active step index ref
 * @param setStepStates - Target set step states
 * @param setRun - Target set run
 * @returns The resolved result
 * @author Maruf Bepary
 */
function handleStepStartEvent(
  event: Record<string, unknown>,
  activeStepIndexRef: React.MutableRefObject<number | null>,
  setStepStates: React.Dispatch<
    React.SetStateAction<Record<number, StepState>>
  >,
  setRun: React.Dispatch<React.SetStateAction<TransformRun | null>>,
) {
  const stepIndex = event.stepIndex as number;
  activeStepIndexRef.current = stepIndex;
  setStepStates((prev) => applyStepStartEvent(prev, stepIndex));
  setRun((prev) => (prev ? { ...prev, currentStepIndex: stepIndex } : prev));
}

/**
 * Performs handle review required event.
 *
 * @param event - Target event
 * @param setStepStates - Target set step states
 * @param setRun - Target set run
 * @returns The resolved result
 * @author Maruf Bepary
 */
function handleReviewRequiredEvent(
  event: Record<string, unknown>,
  setStepStates: React.Dispatch<
    React.SetStateAction<Record<number, StepState>>
  >,
  setRun: React.Dispatch<React.SetStateAction<TransformRun | null>>,
) {
  const stepIndex = event.stepIndex as number;
  setStepStates((prev) => applyReviewRequiredToStep(prev, stepIndex));
  setRun((prev) =>
    prev
      ? {
          ...prev,
          status: "awaiting_review",
          currentStepIndex: stepIndex,
        }
      : prev,
  );
}

/**
 * Performs handle tool call event.
 *
 * @param event - Target event
 * @param activeStepIndex - Target active step index
 * @param setStepStates - Target set step states
 * @returns The resolved result
 * @author Maruf Bepary
 */
function handleToolCallEvent(
  event: Record<string, unknown>,
  activeStepIndex: number | null,
  setStepStates: React.Dispatch<
    React.SetStateAction<Record<number, StepState>>
  >,
) {
  if (activeStepIndex === null) return;
  setStepStates((prev) =>
    applyToolCallToStep(prev, activeStepIndex, {
      toolCallId: event.toolCallId as string,
      toolName: event.toolName as string,
      args: event.args,
      serverName: event.serverName as string,
    }),
  );
}

/**
 * Performs handle tool result event.
 *
 * @param event - Target event
 * @param activeStepIndex - Target active step index
 * @param setStepStates - Target set step states
 * @returns The resolved result
 * @author Maruf Bepary
 */
function handleToolResultEvent(
  event: Record<string, unknown>,
  activeStepIndex: number | null,
  setStepStates: React.Dispatch<
    React.SetStateAction<Record<number, StepState>>
  >,
) {
  if (activeStepIndex === null) return;
  setStepStates((prev) =>
    applyToolResultToStep(prev, activeStepIndex, {
      toolCallId: event.toolCallId as string,
      toolName: event.toolName as string,
      result: event.result,
      serverName: event.serverName as string,
    }),
  );
}

/**
 * Performs handle transform complete event.
 *
 * @param event - Target event
 * @param setRun - Target set run
 * @param loadAttachmentUrls - Target load attachment urls
 * @returns The resolved result
 * @author Maruf Bepary
 */
function handleTransformCompleteEvent(
  event: Record<string, unknown>,
  setRun: React.Dispatch<React.SetStateAction<TransformRun | null>>,
  loadAttachmentUrls: (ids: string[]) => Promise<unknown>,
) {
  const outputIds = (event.outputAttachmentIds as string[]) ?? [];
  setRun((prev) =>
    prev
      ? { ...prev, status: "completed", outputAttachmentIds: outputIds }
      : prev,
  );
  toast.success("Transformation complete");
  if (outputIds.length > 0) {
    loadAttachmentUrls(outputIds);
  }
}

/**
 * Performs handle transform error event.
 *
 * @param event - Target event
 * @param setStreamError - Target set stream error
 * @param setRun - Target set run
 * @param handleApiError - Target handle api error
 * @returns The resolved result
 * @author Maruf Bepary
 */
function handleTransformErrorEvent(
  event: Record<string, unknown>,
  setStreamError: (msg: string) => void,
  setRun: React.Dispatch<React.SetStateAction<TransformRun | null>>,
  handleApiError: (err: unknown) => boolean,
) {
  const errorMsg = event.message as string;
  setStreamError(errorMsg);
  setRun((prev) => (prev ? { ...prev, status: "failed" } : prev));
  if (!handleApiError(event)) {
    toast.error(errorMsg);
  }
}

/**
 * Represents sse dispatch context.
 *
 * @author Maruf Bepary
 */
interface SseDispatchContext {
  setRun: React.Dispatch<React.SetStateAction<TransformRun | null>>;
  setStepStates: React.Dispatch<
    React.SetStateAction<Record<number, StepState>>
  >;
  activeStepIndexRef: React.MutableRefObject<number | null>;
  handleStepCompleteEvent: (event: Record<string, unknown>) => void;
  loadAttachmentUrls: (ids: string[]) => Promise<unknown>;
  setStreamError: (msg: string) => void;
  handleApiError: (err: unknown) => boolean;
}

/**
 * Performs dispatch sse event.
 *
 * @param event - Target event
 * @param ctx - Target ctx
 * @returns The resolved result
 * @author Maruf Bepary
 */
function dispatchSseEvent(
  event: Record<string, unknown>,
  ctx: SseDispatchContext,
) {
  switch (event.type) {
    case "transform-start":
      ctx.setRun((prev) => (prev ? { ...prev, status: "running" } : prev));
      break;
    case "transform-step-start":
      handleStepStartEvent(
        event,
        ctx.activeStepIndexRef,
        ctx.setStepStates,
        ctx.setRun,
      );
      break;
    case "tool-call":
      handleToolCallEvent(
        event,
        ctx.activeStepIndexRef.current,
        ctx.setStepStates,
      );
      break;
    case "tool-result":
      handleToolResultEvent(
        event,
        ctx.activeStepIndexRef.current,
        ctx.setStepStates,
      );
      break;
    case "transform-step-complete":
      ctx.handleStepCompleteEvent(event);
      break;
    case "transform-review-required":
      handleReviewRequiredEvent(event, ctx.setStepStates, ctx.setRun);
      break;
    case "transform-complete":
      handleTransformCompleteEvent(event, ctx.setRun, ctx.loadAttachmentUrls);
      break;
    case "error":
      handleTransformErrorEvent(
        event,
        ctx.setStreamError,
        ctx.setRun,
        ctx.handleApiError,
      );
      break;
  }
}

/**
 * Performs process new realtime messages.
 *
 * @param all - Target all
 * @param lastProcessedIndex - Target last processed index
 * @param onEvent - Target on event
 * @returns The resolved result
 * @author Maruf Bepary
 */
function processNewRealtimeMessages(
  all: readonly { data?: unknown }[],
  lastProcessedIndex: number,
  onEvent: (event: Record<string, unknown>) => void,
): number {
  const start = all.length < lastProcessedIndex ? 0 : lastProcessedIndex;
  for (let i = start; i < all.length; i++) {
    const msg = all[i];
    if (msg?.data) {
      onEvent(msg.data as Record<string, unknown>);
    }
  }
  return all.length;
}

/**
 * Custom hook that provides use realtime run messages functionality.
 *
 * @param runId - Workflow run identifier
 * @param isExecutionActive - Target is execution active
 * @param handleSseEvent - Target handle sse event
 * @returns Hook state and control handlers.
 * @author Maruf Bepary
 */
function useRealtimeRunMessages(
  runId: string,
  isExecutionActive: boolean,
  handleSseEvent: (event: Record<string, unknown>) => void,
) {
  const lastProcessedIndexRef = useRef(0);

  const fetchToken = useCallback(
    () =>
      runId
        ? getTransformRunRealtimeToken(runId)
        : Promise.reject(new Error("No runId")),
    [runId],
  );

  const apiBaseUrl = useMemo(() => getRealtimeApiBaseUrl(), []);

  const { messages } = useRealtime({
    channel: runId ? transformRunChannel({ runId }) : undefined,
    topics: ["progress"] as const,
    token: fetchToken,
    enabled: !!runId && isExecutionActive,
    historyLimit: null,
    apiBaseUrl,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: Reset pointer on runId change
  useEffect(() => {
    lastProcessedIndexRef.current = 0;
  }, [runId]);

  useEffect(() => {
    lastProcessedIndexRef.current = processNewRealtimeMessages(
      messages.all,
      lastProcessedIndexRef.current,
      handleSseEvent,
    );
  }, [messages.all, handleSseEvent]);
}

/**
 * Custom hook that provides use pending run auto starter functionality.
 *
 * @param run - Target run
 * @param agent - Target agent
 * @param onError - Target on error
 * @returns Hook state and control handlers.
 * @author Maruf Bepary
 */
function usePendingRunAutoStarter(
  run: TransformRun | null,
  agent: TransformAgent | null,
  onError: (msg: string) => void,
) {
  const hasStartedStream = useRef(false);

  useEffect(() => {
    if (
      !run ||
      !agent ||
      hasStartedStream.current ||
      run.status !== "pending"
    ) {
      return;
    }
    hasStartedStream.current = true;
    startTransformRunAction(run.id).catch((err) => {
      const msg = err instanceof Error ? err.message : "Failed to start run";
      onError(msg);
      toast.error(msg);
    });
  }, [run, agent, onError]);
}

/**
 * Represents use transform run stream params.
 *
 * @author Maruf Bepary
 */
export interface UseTransformRunStreamParams {
  runId: string;
  run: TransformRun | null;
  agent: TransformAgent | null;
  setRun: React.Dispatch<React.SetStateAction<TransformRun | null>>;
  setStepStates: React.Dispatch<
    React.SetStateAction<Record<number, StepState>>
  >;
  setSelectedStepIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setIsArtifactOpen: React.Dispatch<React.SetStateAction<boolean>>;
  loadAttachmentUrls: (ids: string[]) => Promise<unknown>;
}

/**
 * Handles real-time SSE execution stream, tool events, and automatic start of pending runs.
 *
 * @param params - Target params
 * @returns Hook state and control handlers.
 * @author Maruf Bepary
 */
export function useTransformRunStream(params: UseTransformRunStreamParams) {
  const {
    runId,
    run,
    agent,
    setRun,
    setStepStates,
    setSelectedStepIndex,
    setIsArtifactOpen,
    loadAttachmentUrls,
  } = params;

  const { handleApiError } = useApiError();
  const [streamError, setStreamError] = useState<string | null>(null);
  const activeStepIndexRef = useRef<number | null>(null);

  const handleStepCompleteEvent = useCallback(
    (event: Record<string, unknown>) => {
      const stepIdx = event.stepIndex as number;
      const outAttId = event.outputAttachmentId as string | undefined;
      const outAttIds = event.outputAttachmentIds as string[] | undefined;

      setStepStates((prev) =>
        applyStepCompleteToStep(prev, stepIdx, {
          summary: event.summary as string,
          stepData: event.stepData as Record<string, any[]>,
          artifact: (event.artifact as ArtifactData | null) ?? null,
          outputAttachmentId: outAttId,
        }),
      );
      setSelectedStepIndex(stepIdx);
      setIsArtifactOpen(true);

      if (outAttId) {
        loadAttachmentUrls([outAttId]);
      }

      if (outAttIds && outAttIds.length > 0) {
        setRun((prev) =>
          prev ? { ...prev, outputAttachmentIds: outAttIds } : prev,
        );
      }
    },
    [
      loadAttachmentUrls,
      setIsArtifactOpen,
      setSelectedStepIndex,
      setRun,
      setStepStates,
    ],
  );

  const handleSseEvent = useCallback(
    (event: Record<string, unknown>) => {
      dispatchSseEvent(event, {
        setRun,
        setStepStates,
        activeStepIndexRef,
        handleStepCompleteEvent,
        loadAttachmentUrls,
        setStreamError,
        handleApiError,
      });
    },
    [
      handleApiError,
      handleStepCompleteEvent,
      loadAttachmentUrls,
      setRun,
      setStepStates,
    ],
  );

  const isExecutionActive =
    run?.status === "running" || run?.status === "pending";

  useRealtimeRunMessages(runId, isExecutionActive, handleSseEvent);
  usePendingRunAutoStarter(run, agent, setStreamError);

  return {
    streamError,
  };
}
