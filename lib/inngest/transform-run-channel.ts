import { channel, staticSchema } from "inngest/realtime";

/**
 * Represents transform run stream event.
 *
 * @author Maruf Bepary
 */
export type TransformStreamEvent =
  | { type: "transform-start"; runId: string }
  | {
      type: "transform-step-start";
      runId: string;
      stepIndex: number;
      stepName: string;
      total: number;
    }
  | {
      type: "tool-call";
      toolCallId: string;
      toolName: string;
      args: unknown;
      serverName?: string;
    }
  | {
      type: "tool-result";
      toolCallId: string;
      toolName: string;
      result: unknown;
      serverName?: string;
    }
  | {
      type: "transform-step-complete";
      runId: string;
      stepIndex: number;
      summary?: string;
      stepData?: Record<string, unknown[]>;
      artifact?: unknown;
      outputAttachmentId?: string;
      outputAttachmentIds?: string[];
    }
  | {
      type: "transform-review-required";
      runId: string;
      stepIndex: number;
    }
  | {
      type: "transform-complete";
      runId: string;
      outputAttachmentIds: string[];
    }
  | {
      type: "error";
      message: string;
      code?: string;
    };

type TransformRunStreamEvent = TransformStreamEvent;

/**
 * Realtime channel for streaming transform agent workflow progress.
 * Parametrised by runId to scope events per workflow run.
 */
export const transformRunChannel = channel({
  name: ({ runId }: { runId: string }) => `transform:${runId}`,
  topics: {
    progress: { schema: staticSchema<TransformRunStreamEvent>() },
  },
});
