"use server";

import { and, eq } from "drizzle-orm";
import type { z } from "zod";
import { db } from "@/drizzle/db";
import { chat } from "@/drizzle/schemas/chat-schema";
import { knowledgebase } from "@/drizzle/schemas/knowledgebase-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import { updateChatKnowledgebaseSchema } from "@/schemas/chat/chat";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Updates chat knowledge base after validating ownership. Pass null to disable RAG context.
 *
 * @param data - {chatId, knowledgebaseId} payload
 * @returns Result void.
 * @author Maruf Bepary
 */
export const updateChatKnowledgebase = defineAction(
  async (
    data: z.infer<typeof updateChatKnowledgebaseSchema>,
  ): Promise<Result<void, CommonError>> => {
    const session = await requireSession();

    const parsed = updateChatKnowledgebaseSchema.safeParse(data);
    if (!parsed.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: "Invalid input",
      });
    }

    const validated = parsed.data;

    if (validated.knowledgebaseId) {
      const [kb] = await db
        .select({ id: knowledgebase.id })
        .from(knowledgebase)
        .where(
          and(
            eq(knowledgebase.id, validated.knowledgebaseId),
            eq(knowledgebase.userId, session.user.id),
          ),
        );

      if (!kb) {
        return fail({
          code: ERROR_CODE.NOT_FOUND,
          message: "Not Found",
        });
      }
    }

    const [row] = await db
      .update(chat)
      .set({ knowledgebaseId: validated.knowledgebaseId })
      .where(
        and(eq(chat.id, validated.chatId), eq(chat.userId, session.user.id)),
      )
      .returning({ id: chat.id });

    if (!row) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Not Found",
      });
    }

    return ok(undefined);
  },
);
