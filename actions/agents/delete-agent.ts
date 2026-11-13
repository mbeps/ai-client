"use server";

import { and, eq, inArray, sql } from "drizzle-orm";
import { isBuiltInAgentId } from "@/config/built-in-agents";
import { db } from "@/drizzle/db";
import { agent } from "@/drizzle/schemas/agent-schema";
import { chat } from "@/drizzle/schemas/chat-schema";
import { project } from "@/drizzle/schemas/project-schema";
import { prompt } from "@/drizzle/schemas/prompt-schema";
import { skill } from "@/drizzle/schemas/skill-schema";
import { transformAgent } from "@/drizzle/schemas/transform-agent-schema";
import { requireSession } from "@/lib/auth/require-session";
import { whereOwner } from "@/lib/db/where-owner";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { getLogger } from "@/lib/logger";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

const log = getLogger(["app", "actions", "agent"]);

/**
 * Deletes one or more custom Agents owned by the authenticated user and atomically
 * unbinds all references from chats, parent agents, projects, transform workflows, skills, and prompts.
 *
 * @param idOrIds - Single agent UUID or array of agent UUIDs to delete.
 * @returns Result wrapping `{ deletedCount }`.
 */
export const deleteAgent = defineAction(
  async (
    idOrIds: string | string[],
  ): Promise<Result<{ deletedCount: number }, CommonError>> => {
    const session = await requireSession();
    const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];

    if (ids.length === 0) {
      return ok({ deletedCount: 0 });
    }

    if (ids.some((id) => isBuiltInAgentId(id))) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: "Built-in agents cannot be deleted",
      });
    }

    const deletedCount = await db.transaction(async (tx) => {
      const deleted = await tx
        .delete(agent)
        .where(whereOwner(agent, ids, session.user.id))
        .returning({ id: agent.id });

      if (deleted.length === 0) {
        return 0;
      }

      const deletedIds = deleted.map((row) => row.id);

      await tx
        .update(chat)
        .set({ agentId: null })
        .where(
          and(
            eq(chat.userId, session.user.id),
            inArray(chat.agentId, deletedIds),
          ),
        );

      for (const deletedId of deletedIds) {
        await Promise.all([
          tx
            .update(agent)
            .set({
              subagentIds: sql`array_remove(${agent.subagentIds}, ${deletedId})`,
            })
            .where(
              and(
                eq(agent.userId, session.user.id),
                sql`${deletedId} = ANY(${agent.subagentIds})`,
              ),
            ),
          tx
            .update(project)
            .set({
              subagentIds: sql`array_remove(${project.subagentIds}, ${deletedId})`,
            })
            .where(
              and(
                eq(project.userId, session.user.id),
                sql`${deletedId} = ANY(${project.subagentIds})`,
              ),
            ),
          tx
            .update(transformAgent)
            .set({
              subagentIds: sql`array_remove(${transformAgent.subagentIds}, ${deletedId})`,
            })
            .where(
              and(
                eq(transformAgent.userId, session.user.id),
                sql`${deletedId} = ANY(${transformAgent.subagentIds})`,
              ),
            ),
          tx
            .update(skill)
            .set({
              agentIds: sql`array_remove(${skill.agentIds}, ${deletedId})`,
            })
            .where(
              and(
                eq(skill.userId, session.user.id),
                sql`${deletedId} = ANY(${skill.agentIds})`,
              ),
            ),
          tx
            .update(prompt)
            .set({
              agentIds: sql`array_remove(${prompt.agentIds}, ${deletedId})`,
            })
            .where(
              and(
                eq(prompt.userId, session.user.id),
                sql`${deletedId} = ANY(${prompt.agentIds})`,
              ),
            ),
        ]);
      }

      return deleted.length;
    });

    if (deletedCount === 0) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Not Found",
      });
    }

    log.info("Deleted Agents (count: {deletedCount})", {
      deletedCount,
      userId: session.user.id,
    });

    return ok({ deletedCount });
  },
);
