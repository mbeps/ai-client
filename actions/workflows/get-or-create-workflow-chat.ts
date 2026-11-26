"use server";

import { and, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { chat } from "@/drizzle/schemas/chat-schema";
import { workflow } from "@/drizzle/schemas/workflow-schema";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { ChatRow } from "@/types/chat/chat-row";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Verifies that `workflowId` exists and belongs to `userId`.
 * Returns the workflow's `{ id, name }` or `null` if not found.
 */
async function findOwnedWorkflow(
  workflowId: string,
  userId: string,
): Promise<{ id: string; name: string } | null> {
  const [row] = await db
    .select({ id: workflow.id, name: workflow.name })
    .from(workflow)
    .where(and(eq(workflow.id, workflowId), eq(workflow.userId, userId)));
  return row ?? null;
}

/**
 * Returns the existing builder chat for `workflowId`, or creates one if none exists.
 * Enforces workflow ownership via session check.
 *
 * @param workflowId - The workflow ID to scope the builder chat to.
 * @returns Result containing the workflow-scoped ChatRow, or NOT_FOUND if unowned/missing.
 */
export const getOrCreateWorkflowChat = defineAction(
  async (workflowId: string): Promise<Result<ChatRow, CommonError>> => {
    const session = await requireSession();
    const owned = await findOwnedWorkflow(workflowId, session.user.id);
    if (!owned) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Workflow not found",
      });
    }

    const [existing] = await db
      .select()
      .from(chat)
      .where(
        and(eq(chat.workflowId, workflowId), eq(chat.userId, session.user.id)),
      );
    if (existing) {
      return ok(existing);
    }

    const [created] = await db
      .insert(chat)
      .values({
        id: crypto.randomUUID(),
        title: `Builder: ${owned.name}`,
        userId: session.user.id,
        workflowId,
      })
      .returning();

    return ok(created);
  },
);

/**
 * Deletes any existing builder chat for `workflowId` and creates a fresh session.
 * Enforces workflow ownership via session check.
 *
 * @param workflowId - The workflow ID whose builder chat should be reset.
 * @returns Result containing the newly created ChatRow, or NOT_FOUND if unowned/missing.
 */
export const resetWorkflowChat = defineAction(
  async (workflowId: string): Promise<Result<ChatRow, CommonError>> => {
    const session = await requireSession();
    const owned = await findOwnedWorkflow(workflowId, session.user.id);
    if (!owned) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Workflow not found",
      });
    }

    await db
      .delete(chat)
      .where(
        and(eq(chat.workflowId, workflowId), eq(chat.userId, session.user.id)),
      );

    const [created] = await db
      .insert(chat)
      .values({
        id: crypto.randomUUID(),
        title: `Builder: ${owned.name}`,
        userId: session.user.id,
        workflowId,
      })
      .returning();

    return ok(created);
  },
);
