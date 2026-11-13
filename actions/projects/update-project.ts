"use server";

import { z } from "zod";
import { db } from "@/drizzle/db";
import { project } from "@/drizzle/schemas/project-schema";
import { validateTargetSubagentIds } from "@/lib/agents/validate-subagent-links";
import { requireSession } from "@/lib/auth/require-session";
import { whereOwner } from "@/lib/db/where-owner";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { getLogger } from "@/lib/logger";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import { updateProjectSchema } from "@/schemas/project/project";
import type { CommonError } from "@/types/error/common-error";
import type { ProjectRow } from "@/types/project/project-row";
import type { Result } from "@/types/result";

const log = getLogger(["app", "actions", "project"]);

function buildProjectUpdateValues(
  data: z.infer<typeof updateProjectSchema>,
): Record<string, unknown> {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name !== undefined) values.name = data.name;
  if (data.description !== undefined) values.description = data.description;
  if (data.globalPrompt !== undefined) values.globalPrompt = data.globalPrompt;
  if (data.tools !== undefined) values.tools = data.tools;
  if (data.skillMode !== undefined) values.skillMode = data.skillMode;
  if (data.skillIds !== undefined) values.skillIds = data.skillIds;
  if (data.promptMode !== undefined) values.promptMode = data.promptMode;
  if (data.promptIds !== undefined) values.promptIds = data.promptIds;
  if (data.subagentIds !== undefined) values.subagentIds = data.subagentIds;
  if (data.knowledgebaseId !== undefined)
    values.knowledgebaseId = data.knowledgebaseId ?? null;
  return values;
}

/**
 * Updates an existing project with partial field updates.
 * Validates all inputs, verifies Rule 1 on `subagentIds` if provided, and enforces ownership check.
 *
 * @param id - UUID of the project to update; must be owned by the authenticated user.
 * @param data - Partial project update object.
 * @returns Result wrapping the updated `ProjectRow`.
 */
export const updateProject = defineAction(
  async (
    id: string,
    data: z.input<typeof updateProjectSchema>,
  ): Promise<Result<ProjectRow, CommonError>> => {
    const session = await requireSession();

    const idParsed = z.string().uuid().safeParse(id);
    if (!idParsed.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: "Invalid entity ID format",
      });
    }
    const validatedId = idParsed.data;

    const dataParsed = updateProjectSchema.safeParse(data);
    if (!dataParsed.success) {
      const issues = dataParsed.error.issues.map((i) =>
        i.path.length > 0 ? `${i.path.join(".")}: ${i.message}` : i.message,
      );
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: dataParsed.error.issues[0].message,
        issues,
      });
    }
    const validatedData = dataParsed.data;

    if (validatedData.subagentIds && validatedData.subagentIds.length > 0) {
      const linkCheck = await validateTargetSubagentIds(
        session.user.id,
        validatedData.subagentIds,
      );
      if (!linkCheck.ok) {
        return linkCheck;
      }
    }

    const [row] = await db
      .update(project)
      .set(buildProjectUpdateValues(validatedData))
      .where(whereOwner(project, validatedId, session.user.id))
      .returning();

    if (!row) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Not Found",
      });
    }

    log.info("Updated entity (id: {id})", {
      id: validatedId,
      userId: session.user.id,
    });

    return ok(row);
  },
);
