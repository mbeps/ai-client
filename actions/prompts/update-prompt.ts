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

    if (validatedData.projectId) {
      const [proj] = await db
        .select()
        .from(project)
        .where(whereOwner(project, validatedData.projectId, session.user.id));
      if (!proj) {
        return fail({
          code: ERROR_CODE.NOT_FOUND,
          message: "Project not found",
        });
      }
    }

    if (validatedData.assistantId) {
      const [asst] = await db
        .select()
        .from(assistant)
        .where(
          whereOwner(assistant, validatedData.assistantId, session.user.id),
        );
      if (!asst) {
        return fail({
          code: ERROR_CODE.NOT_FOUND,
          message: "Assistant not found",
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
    if (validatedData.projectId !== undefined)
      updateValues.projectId = validatedData.projectId;
    if (validatedData.assistantId !== undefined)
      updateValues.assistantId = validatedData.assistantId;

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
