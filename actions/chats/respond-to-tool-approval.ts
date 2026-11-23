"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { chat, message } from "@/drizzle/schemas/chat-schema";
import { requireSession } from "@/lib/auth/require-session";
import { chatApprovalRegistry } from "@/lib/chat/chat-approval-registry";
import { parseMessageMetadata } from "@/lib/chat/parse-message-metadata";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { inngest } from "@/lib/inngest/client";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import { approvalDecisionSchema } from "@/schemas/chat/chat";
import { idField } from "@/schemas/shared-fields";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";
import type { ApprovalDecision } from "@/types/tool/approval";

const respondToToolApprovalSchema = z
  .object({
    assistantMessageId: idField,
    decisions: z.array(approvalDecisionSchema),
  })
  .strict();

/**
 * Submits user approval decisions for all pending tool calls on a paused
 * assistant message.
 *
 * Reads `pendingApprovals` authoritatively from PostgreSQL (never trusting
 * client-supplied tool names, arguments, or signatures), enforces completeness
 * and strict emission order, and either unblocks an in-flight subagent via
 * `chatApprovalRegistry` or dispatches `chat/approval.respond` to Inngest.
 *
 * @param rawInput - `{ assistantMessageId, decisions }` payload from the client.
 * @returns `ok({ success: true })` or a typed `CommonError` failure.
 */
export const respondToToolApproval = defineAction(
  async (
    rawInput: unknown,
  ): Promise<Result<{ success: true }, CommonError>> => {
    const session = await requireSession();
    const parsed = respondToToolApprovalSchema.safeParse(rawInput);

    if (!parsed.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: "Invalid tool approval payload",
      });
    }

    const { assistantMessageId, decisions } = parsed.data;

    const [row] = await db
      .select({
        messageId: message.id,
        chatId: message.chatId,
        role: message.role,
        metadata: message.metadata,
      })
      .from(message)
      .innerJoin(chat, eq(message.chatId, chat.id))
      .where(
        and(
          eq(message.id, assistantMessageId),
          eq(chat.userId, session.user.id),
        ),
      )
      .limit(1);

    if (row?.role !== "assistant") {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Assistant message not found",
      });
    }

    const meta = parseMessageMetadata(row.metadata);
    if (meta.pendingApprovals.length === 0) {
      return ok({ success: true });
    }

    const decisionMap = new Map<string, boolean>();
    for (const decision of decisions) {
      decisionMap.set(decision.approvalId, decision.approved);
    }

    const accepted: ApprovalDecision[] = [];
    for (const pending of meta.pendingApprovals) {
      const approved = decisionMap.get(pending.approvalId);
      if (approved === undefined) {
        return fail({
          code: ERROR_CODE.INVALID_INPUT,
          message: "All pending tool calls must be answered together",
        });
      }
      accepted.push({ approvalId: pending.approvalId, approved });
    }

    if (chatApprovalRegistry.canResolve(assistantMessageId, accepted)) {
      const existingMetadata = JSON.parse(row.metadata as string) as Record<
        string,
        unknown
      >;
      await db
        .update(message)
        .set({
          metadata: JSON.stringify({
            ...existingMetadata,
            pendingApprovals: [],
          }),
          updatedAt: new Date(),
        })
        .where(
          and(
            eq(message.id, assistantMessageId),
            eq(message.metadata, row.metadata as string),
          ),
        );

      chatApprovalRegistry.resolve(assistantMessageId, accepted);
      return ok({ success: true });
    }

    await inngest.send({
      name: "chat/approval.respond",
      data: {
        chatId: row.chatId,
        userId: session.user.id,
        userName: session.user.name,
        userEmail: session.user.email,
        assistantMessageId,
        userMessageId: meta.parentUserMessageId ?? undefined,
        decisions: accepted,
      },
    });

    return ok({ success: true });
  },
);
