import { channel, staticSchema } from "inngest/realtime";

/**
 * Represents chat stream event.
 *
 * @author Maruf Bepary
 */
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
      preliminary?: boolean;
    }
  | { type: "finish"; finishReason?: string; usage?: unknown }
  | { type: "error"; message: string; code?: string };

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
