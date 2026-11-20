"use server";

import type { z } from "zod";
import { DEFAULT_ENABLED_TOOLS } from "@/config/tools";
import { db } from "@/drizzle/db";
import { project } from "@/drizzle/schemas/project-schema";
import {
  type SubagentLinkTx,
  validateTargetSubagentIds,
  withSubagentLinkLock,
} from "@/lib/agents/validate-subagent-links";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { getLogger } from "@/lib/logger";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import { createProjectSchema } from "@/schemas/project/project";
import type { CommonError } from "@/types/error/common-error";
import type { ProjectRow } from "@/types/project/project-row";
import type { Result } from "@/types/result";

const log = getLogger(["app", "actions", "project"]);

/**
 * Creates a new project for the authenticated user.
 * Validates input against `createProjectSchema` and verifies Rule 1 on `subagentIds` if provided.
 *
 * @param data - Project configuration object validated against `createProjectSchema`.
 * @returns Result wrapping the newly created `ProjectRow`.
 */
export const createProject = defineAction(
  async (
    data: z.input<typeof createProjectSchema>,
  ): Promise<Result<ProjectRow, CommonError>> => {
    const session = await requireSession();

    const parsed = createProjectSchema.safeParse(data);
    if (!parsed.success) {
      const issues = parsed.error.issues.map((i) =>
        i.path.length > 0 ? `${i.path.join(".")}: ${i.message}` : i.message,
      );
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: parsed.error.issues[0].message,
        issues,
      });
    }

    const validated = parsed.data;
    const subagentIds = validated.subagentIds ?? [];
    const insertProject = async (executor: SubagentLinkTx) => {
      const [inserted] = await executor
        .insert(project)
        .values({
          name: validated.name,
          description: validated.description ?? null,
          globalPrompt: validated.globalPrompt ?? null,
          tools: validated.tools ?? [...DEFAULT_ENABLED_TOOLS],
          skillMode: validated.skillMode,
          skillIds: validated.skillIds,
          promptMode: validated.promptMode,
          promptIds: validated.promptIds,
          subagentIds,
          knowledgebaseId: validated.knowledgebaseId ?? null,
          userId: session.user.id,
        })
        .returning();
      return inserted;
    };

    let row: ProjectRow;
    if (subagentIds.length > 0) {
      const txResult = await withSubagentLinkLock(
        session.user.id,
        async (tx) => {
          const linkCheck = await validateTargetSubagentIds(
            session.user.id,
            subagentIds,
            undefined,
            tx,
          );
          if (!linkCheck.ok) {
            return linkCheck;
          }
          return ok(await insertProject(tx));
        },
      );
      if (!txResult.ok) {
        return txResult;
      }
      row = txResult.value;
    } else {
      row = await insertProject(db);
    }

    log.info("Created Project (id: {id})", {
      id: row.id,
      projectId: row.id,
      name: row.name,
      userId: session.user.id,
    });

    return ok(row);
  },
);
