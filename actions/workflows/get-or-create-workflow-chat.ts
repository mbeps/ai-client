"use server";

import { and, desc, eq } from "drizzle-orm";
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
 * Inserts a new workflow builder chat row using `txOrDb`.
 */
async function insertWorkflowBuilderChat(
  txOrDb: Pick<typeof db, "insert">,
  userId: string,
  workflowId: string,
  workflowName: string,
): Promise<ChatRow> {
  const [created] = await txOrDb
    .insert(chat)
    .values({
      id: crypto.randomUUID(),
      title: `Builder: ${workflowName}`,
      userId,
      workflowId,
    })
    .returning();
  return created;
}

/**
 * Returns the most recent builder chat for `workflowId`, or creates one if none exists.
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
      )
      .orderBy(desc(chat.updatedAt))
      .limit(1);
    if (existing) {
      return ok(existing);
    }

    const created = await insertWorkflowBuilderChat(
      db,
      session.user.id,
      workflowId,
      owned.name,
    );

    return ok(created);
  },
);

/**
 * Creates a fresh builder chat session for `workflowId` while preserving prior chat history.
 * Enforces workflow ownership via session check.
 *
 * @param workflowId - The workflow ID to create a new builder chat for.
 * @returns Result containing the newly created ChatRow, or NOT_FOUND if unowned/missing.
 */
export const createWorkflowChat = defineAction(
  async (workflowId: string): Promise<Result<ChatRow, CommonError>> => {
    const session = await requireSession();
    const owned = await findOwnedWorkflow(workflowId, session.user.id);
    if (!owned) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Workflow not found",
      });
    }

    const created = await insertWorkflowBuilderChat(
      db,
      session.user.id,
      workflowId,
      owned.name,
    );

    return ok(created);
  },
);

/**
 * Lists all builder chat sessions for `workflowId`, ordered by most recently updated first.
 * Enforces workflow ownership via session check.
 *
 * @param workflowId - The workflow ID whose builder chat history should be listed.
 * @returns Result containing ChatRow[], or NOT_FOUND if unowned/missing.
 */
export const listWorkflowChats = defineAction(
  async (workflowId: string): Promise<Result<ChatRow[], CommonError>> => {
    const session = await requireSession();
    const owned = await findOwnedWorkflow(workflowId, session.user.id);
    if (!owned) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Workflow not found",
      });
    }

    const rows = await db
      .select()
      .from(chat)
      .where(
        and(eq(chat.workflowId, workflowId), eq(chat.userId, session.user.id)),
      )
      .orderBy(desc(chat.updatedAt));

    return ok(rows);
  },
);
