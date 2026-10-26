import { channel, staticSchema } from "inngest/realtime";

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
