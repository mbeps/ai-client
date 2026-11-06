"use server";

import { db } from "@/drizzle/db";
import { workflowTranslation } from "@/drizzle/schemas/workflow-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { inngest } from "@/lib/inngest/client";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import { translateRequestSchema } from "@/schemas/workflows/workflows";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Server action to initiate an asynchronous background translation via Inngest.
 * Persists the translation record to PostgreSQL, dispatches the Inngest workflow event,
 * and returns the unique translation ID for Realtime subscription.
 *
 * @param input - Translation request parameters matching translateRequestSchema.
 * @returns Result wrapping object with the initiated translationId.
 * @author Maruf Bepary
 */
export const triggerTranslation = defineAction(
  async (
    input: unknown,
  ): Promise<Result<{ translationId: string }, CommonError>> => {
    const session = await requireSession();

    const parsed = translateRequestSchema.safeParse(input);
    if (!parsed.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: `Invalid translation request: ${parsed.error.message}`,
        issues: parsed.error.issues.map((i) => i.message),
      });
    }

    const {
      text: originalText,
      sourceLanguage,
      targetLanguage,
      modelId,
      attachment,
    } = parsed.data;

    const isImage = attachment?.type === "image";
    const sourceText =
      originalText?.trim() || attachment?.extractedText?.trim() || "";

    const [row] = await db
      .insert(workflowTranslation)
      .values({
        userId: session.user.id,
        status: "pending",
        sourceLanguage,
        targetLanguage,
        sourceText,
        modelId: modelId || null,
        attachmentName: attachment?.name || null,
        attachmentType: attachment?.type || null,
      })
      .returning();

    await inngest.send({
      name: "workflows/translate.execute",
      data: {
        translationId: row.id,
        userId: session.user.id,
        sourceLanguage,
        targetLanguage,
        sourceText,
        modelId: modelId || undefined,
        isImage,
        attachmentDataUrl: isImage ? attachment?.dataUrl : undefined,
        attachmentMimeType: isImage ? attachment?.mimeType : undefined,
      },
    });

    return ok({ translationId: row.id });
  },
);
