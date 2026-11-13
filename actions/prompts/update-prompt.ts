"use server";

import { z } from "zod";
import { db } from "@/drizzle/db";
import { assistant } from "@/drizzle/schemas/assistant-schema";
import { project } from "@/drizzle/schemas/project-schema";
import { prompt } from "@/drizzle/schemas/prompt-schema";
import { requireSession } from "@/lib/auth/require-session";
import { whereOwner } from "@/lib/db/where-owner";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import { updatePromptSchema } from "@/schemas/prompt/prompt";
import type { CommonError } from "@/types/error/common-error";
import type { PromptRow } from "@/types/prompt/prompt-row";
import type { Result } from "@/types/result";

/**
 * Updates an existing prompt with partial field updates (shortcut, title, content, projectId, assistantId).
 * Validates all inputs and enforces ownership check before updating database record.
 * Verifies foreign entity ownership if projectId or assistantId is updated.
 * Shortcut changes immediately affect slash command triggers in chat interface.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param id - UUID of the prompt to update; must be owned by the authenticated user.
 * @param data - Partial prompt update object (shortcut, title, content, projectId, assistantId fields).
 * @returns The Result containing updated prompt record with all fields populated.
 * @author Maruf Bepary
 */
export const updatePrompt = defineAction(
  async (
    id: string,
    data: z.infer<typeof updatePromptSchema>,
  ): Promise<Result<PromptRow, CommonError>> => {
    const session = await requireSession();

    const idParsed = z.string().uuid().safeParse(id);
    if (!idParsed.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: "Invalid entity ID format",
      });
    }
    const validatedId = idParsed.data;

    const dataParsed = updatePromptSchema.safeParse(data);
    if (!dataParsed.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: dataParsed.error.issues[0].message,
      });
    }
    const validatedData = dataParsed.data;

    if (validatedData.projectIds && validatedData.projectIds.length > 0) {
      const owned = await db
        .select({ id: project.id })
        .from(project)
        .where(whereOwner(project, validatedData.projectIds, session.user.id));
      if (owned.length !== validatedData.projectIds.length) {
        return fail({
          code: ERROR_CODE.NOT_FOUND,
          message: "One or more projects not found",
        });
      }
    }

    if (validatedData.assistantIds && validatedData.assistantIds.length > 0) {
      const owned = await db
        .select({ id: assistant.id })
        .from(assistant)
        .where(
          whereOwner(assistant, validatedData.assistantIds, session.user.id),
        );
      if (owned.length !== validatedData.assistantIds.length) {
        return fail({
          code: ERROR_CODE.NOT_FOUND,
          message: "One or more assistants not found",
        });
      }
    }

    const updateValues: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (validatedData.title !== undefined)
      updateValues.title = validatedData.title;
    if (validatedData.shortcut !== undefined)
      updateValues.shortcut = validatedData.shortcut;
    if (validatedData.content !== undefined)
      updateValues.content = validatedData.content;
    if (validatedData.projectIds !== undefined)
      updateValues.projectIds = validatedData.projectIds;
    if (validatedData.assistantIds !== undefined)
      updateValues.agentIds = validatedData.assistantIds;

    const [row] = await db
      .update(prompt)
      .set(updateValues)
      .where(whereOwner(prompt, validatedId, session.user.id))
      .returning();

    if (!row) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Not Found",
      });
    }

    return ok(row);
  },
);
