import { streamText } from "ai";
import { eq } from "drizzle-orm";
import { PROMPTS } from "@/config/prompts";
import { db } from "@/drizzle/db";
import { workflowTranslation } from "@/drizzle/schema";
import { fetchProviderWithModel } from "@/lib/chat/fetch-provider-with-model";
import { resolveDefaultChatProvider } from "@/lib/chat/resolve-default-chat-provider";
import { classifyProviderError } from "@/lib/error/classify-provider-error";
import { translationChannel } from "@/lib/inngest/channels";
import { inngest } from "@/lib/inngest/client";
import { getLogger } from "@/lib/logger";

const log = getLogger(["inngest", "workflow", "translation"]);

export interface TranslationWorkflowEventData {
  translationId: string;
  userId: string;
  sourceLanguage: string;
  targetLanguage: string;
  sourceText: string;
  modelId?: string;
  isImage?: boolean;
  attachmentDataUrl?: string;
  attachmentMimeType?: string;
}

/**
 * Inngest durable function executing AI document and text translation workflows.
 * Runs in the background, streams tokens in real-time over Inngest Realtime,
 * survives page reloads/navigating away, and persists results to PostgreSQL.
 *
 * @author Maruf Bepary
 */
export const executeTranslationWorkflow = inngest.createFunction(
  {
    id: "execute-translation-workflow",
    retries: 0,
    triggers: [{ event: "workflows/translate.execute" }],
  },
  async ({ event }) => {
    const {
      translationId,
      userId,
      sourceLanguage,
      targetLanguage,
      sourceText,
      modelId,
      isImage,
      attachmentDataUrl,
      attachmentMimeType,
    } = event.data as TranslationWorkflowEventData;

    const ch = translationChannel({ translationId });

    try {
      await db
        .update(workflowTranslation)
        .set({ status: "translating" })
        .where(eq(workflowTranslation.id, translationId));

      await inngest.realtime.publish(ch.stream, {
        type: "start",
        translationId,
      });

      const resolved = modelId
        ? await fetchProviderWithModel(userId, { modelId })
        : await resolveDefaultChatProvider(userId);

      const sourceDesc =
        sourceLanguage === "auto" || sourceLanguage === "Auto Detect"
          ? "automatically detected language"
          : sourceLanguage;

      const prompt = PROMPTS.WORKFLOWS.TRANSLATE(
        sourceDesc,
        targetLanguage,
        sourceText,
        isImage,
      );

      const result = streamText({
        model: resolved.sdkProvider.chat(resolved.modelId),
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: prompt },
              ...(isImage && attachmentDataUrl
                ? [
                    {
                      type: "file" as const,
                      data: attachmentDataUrl,
                      mediaType: attachmentMimeType ?? "image",
                    },
                  ]
                : []),
            ],
          },
        ],
      });

      let accumulated = "";
      for await (const chunk of result.textStream) {
        accumulated += chunk;
        await inngest.realtime.publish(ch.stream, {
          type: "text-delta",
          text: chunk,
        });
      }

      const finalTranslated = accumulated.trim();

      await db
        .update(workflowTranslation)
        .set({
          status: "completed",
          translatedText: finalTranslated,
        })
        .where(eq(workflowTranslation.id, translationId));

      await inngest.realtime.publish(ch.stream, {
        type: "finish",
        translatedText: finalTranslated,
      });

      return { success: true, translationId, translatedText: finalTranslated };
    } catch (error) {
      const classified = classifyProviderError(error);
      const errorMessage =
        classified?.message ??
        (error instanceof Error ? error.message : "Translation failed");

      log.error(
        "Translation workflow failed (translationId: {translationId}): {error}",
        {
          translationId,
          error: errorMessage,
        },
      );

      await db
        .update(workflowTranslation)
        .set({
          status: "failed",
          errorMessage,
        })
        .where(eq(workflowTranslation.id, translationId));

      await inngest.realtime.publish(ch.stream, {
        type: "error",
        message: errorMessage,
      });

      throw error;
    }
  },
);
