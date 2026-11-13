"use server";

import type { z } from "zod";
import { db } from "@/drizzle/db";
import { agent } from "@/drizzle/schemas/agent-schema";
import { project } from "@/drizzle/schemas/project-schema";
import { requireSession } from "@/lib/auth/require-session";
import { whereOwner } from "@/lib/db/where-owner";
import { AppException } from "@/lib/error/app-exception";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import { createSkillForUser } from "@/lib/skills/skill-crud-service";
import { createSkillSchema } from "@/schemas/skill/skill";
import { SkillBundleBudgetError } from "@/schemas/skill/skill-file";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";
import type { SkillRow } from "@/types/skill/skill-row";

/**
 * Creates a new Agent Skill for the authenticated user.
 * Enforces slug uniqueness per user and entity ownership if scoped.
 *
 * @param data - Skill creation payload adhering to createSkillSchema
 * @returns Result wrapping created skill database record
 * @author Maruf Bepary
 */
export const createSkill = defineAction(
  async (
    data: z.infer<typeof createSkillSchema>,
  ): Promise<Result<SkillRow, CommonError>> => {
    const session = await requireSession();
    const validated = createSkillSchema.safeParse(data);
    if (!validated.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: validated.error.issues[0].message,
      });
    }

    if (validated.data.projectIds && validated.data.projectIds.length > 0) {
      const owned = await db
        .select({ id: project.id })
        .from(project)
        .where(whereOwner(project, validated.data.projectIds, session.user.id));
      if (owned.length !== validated.data.projectIds.length) {
        return fail({
          code: ERROR_CODE.NOT_FOUND,
          message: "One or more projects not found",
        });
      }
    }

    const agentIds = validated.data.agentIds ?? validated.data.assistantIds;
    if (agentIds && agentIds.length > 0) {
      const owned = await db
        .select({ id: agent.id })
        .from(agent)
        .where(whereOwner(agent, agentIds, session.user.id));
      if (owned.length !== agentIds.length) {
        return fail({
          code: ERROR_CODE.NOT_FOUND,
          message: "One or more agents not found",
        });
      }
    }

    try {
      const row = await createSkillForUser(session.user.id, validated.data);
      return ok(row);
    } catch (err) {
      if (err instanceof AppException) {
        return fail(err.error);
      }
      if (err instanceof SkillBundleBudgetError) {
        return fail({
          code: ERROR_CODE.INVALID_INPUT,
          message: err.message,
        });
      }
      throw err;
    }
  },
);
