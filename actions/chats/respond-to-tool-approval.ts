"use server";

import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/drizzle/db";
import { chat, message } from "@/drizzle/schema";
import { requireSession } from "@/lib/auth/require-session";
import { parseMessageMetadata } from "@/lib/chat/parse-message-metadata";
import { NotFoundError } from "@/lib/errors";
import { inngest } from "@/lib/inngest/client";
import { getLogger } from "@/lib/logger";
import { approvalDecisionSchema } from "@/schemas/chat/chat";

const log = getLogger(["app", "actions", "chat", "approval"]);

const respondToToolApprovalSchema = z.object({
  assistantMessageId: z.string().uuid(),
  decisions: z.array(approvalDecisionSchema).min(1).max(20),
});

/**
 * Records the user's verdict on a paused round of tool calls and asks the
 * generator to resume.
 *
 * The client is trusted with nothing but the verdict. Tool names, arguments,
 * and approval signatures are read back from the stored message, so a tampered
 * payload cannot redirect an approval onto a different call. The resume event
 * carries the name and email because the generator reloads no user row and the
 * system prompt needs them.
 *
 * @param input - Assistant message id plus one verdict per pending call.
 * @returns `{ success: true }`, including when nothing was pending.
 * @throws {NotFoundError} When the row is absent, unowned, or has lost the
 *   parent user message the resume needs to reload the thread.
 * @throws {Error} When only some pending calls are answered. The AI SDK throws
 *   `MissingToolResultsError` on a partial answer and destroys the turn (V7).
 * @author Maruf Bepary
 */
export async function respondToToolApproval(
  input: z.infer<typeof respondToToolApprovalSchema>,
): Promise<{ success: true }> {
  const session = await requireSession();
  const { assistantMessageId, decisions } =
    respondToToolApprovalSchema.parse(input);

  const [row] = await db
    .select({
      id: message.id,
      chatId: message.chatId,
      metadata: message.metadata,
    })
    .from(message)
    .innerJoin(chat, eq(chat.id, message.chatId))
    .where(
      and(eq(message.id, assistantMessageId), eq(chat.userId, session.user.id)),
    );

  if (!row) throw new NotFoundError("Message Not Found");

  const meta = parseMessageMetadata(row.metadata);
  const pending = meta?.pendingApprovals ?? [];
  if (pending.length === 0) {
    // Already resolved, most likely a double click or a refresh that landed
    // after the resume. Nothing left to decide, and nothing to dispatch.
    return { success: true };
  }

  // runChatGeneration reloads the thread up to this id. A missing one would
  // truncate the thread and drop the approval pair it must resume from.
  const userMessageId = meta?.parentUserMessageId ?? null;
  if (!userMessageId) {
    throw new NotFoundError("Approval Context Not Found");
  }

  const known = new Set(pending.map((p) => p.approvalId));
  const accepted = decisions
    .filter((d) => known.has(d.approvalId))
    .map((d) => ({ approvalId: d.approvalId, approved: d.approved }));

  if (accepted.length !== pending.length) {
    throw new Error("All pending tool calls must be answered together");
  }

  log.info("Tool approval decisions recorded (chatId: {chatId})", {
    chatId: row.chatId,
    approved: accepted.filter((d) => d.approved).length,
    denied: accepted.filter((d) => !d.approved).length,
  });

  await inngest.send({
    name: "chat/approval.respond",
    data: {
      chatId: row.chatId,
      userId: session.user.id,
      userName: session.user.name,
      userEmail: session.user.email,
      assistantMessageId: row.id,
      userMessageId,
      decisions: accepted,
    },
  });

  return { success: true };
}
