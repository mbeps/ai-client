"use server";

import { desc, eq } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { agent } from "@/drizzle/schemas/agent-schema";
import { project } from "@/drizzle/schemas/project-schema";
import { transformAgent } from "@/drizzle/schemas/transform-agent-schema";
import { requireSession } from "@/lib/auth/require-session";
import { defineAction } from "@/lib/factories/define-action";
import { ok } from "@/lib/result/ok";
import type { AgentRow } from "@/types/agent/agent-row";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Agent database row enriched with the count of parent entities linking it as a subagent.
 */
export type AgentRowWithUsage = AgentRow & {
  usedByCount: number;
};

/**
 * Lists all custom Agents owned by the authenticated user, ordered by most recently updated first,
 * and computes `usedByCount` across parent Agents, Projects, and Transform Workflows.
 *
 * @returns Result wrapping an array of `AgentRowWithUsage`.
 */
export const listAgents = defineAction(
  async (): Promise<Result<AgentRowWithUsage[], CommonError>> => {
    const session = await requireSession();

    const [agentRows, projectRefs, transformRefs] = await Promise.all([
      db
        .select()
        .from(agent)
        .where(eq(agent.userId, session.user.id))
        .orderBy(desc(agent.updatedAt)),
      db
        .select({ subagentIds: project.subagentIds })
        .from(project)
        .where(eq(project.userId, session.user.id)),
      db
        .select({ subagentIds: transformAgent.subagentIds })
        .from(transformAgent)
        .where(eq(transformAgent.userId, session.user.id)),
    ]);

    const usageCounts = new Map<string, number>();
    const countRefs = (lists: { subagentIds: string[] }[]) => {
      for (const entry of lists) {
        for (const subId of entry.subagentIds) {
          usageCounts.set(subId, (usageCounts.get(subId) ?? 0) + 1);
        }
      }
    };

    countRefs(agentRows);
    countRefs(projectRefs);
    countRefs(transformRefs);

    return ok(
      agentRows.map((row) => ({
        ...row,
        usedByCount: usageCounts.get(row.id) ?? 0,
      })),
    );
  },
);
