import { channel, staticSchema } from "inngest/realtime";

export type ChatStreamEvent =
  | { type: "start"; messageId: string }
  | { type: "text-delta"; text: string }
  | { type: "reasoning-delta"; reasoning: string }
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
  | { type: "finish"; finishReason?: string; usage?: unknown }
  | { type: "error"; message: string; code?: string };

export type TransformRunStreamEvent =
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
    };

/**
 * Realtime channel for streaming chat tokens, reasoning, and tool calls.
 * Parametrised by chatId to scope events per conversation session.
 */
export const chatChannel = channel({
  name: ({ chatId }: { chatId: string }) => `chat:${chatId}`,
  topics: {
    stream: { schema: staticSchema<ChatStreamEvent>() },
  },
});

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

export type TranslationStreamEvent =
  | { type: "start"; translationId: string }
  | { type: "text-delta"; text: string }
  | { type: "finish"; translatedText: string }
  | { type: "error"; message: string };

/**
 * Realtime channel for streaming workflow translation tokens and completion status.
 * Parametrised by translationId to scope events per translation execution.
 */
export const translationChannel = channel({
  name: ({ translationId }: { translationId: string }) =>
    `translation:${translationId}`,
  topics: {
    stream: { schema: staticSchema<TranslationStreamEvent>() },
  },
});
