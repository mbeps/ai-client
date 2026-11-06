"use server";

import { and, eq, inArray } from "drizzle-orm";
import { db } from "@/drizzle/db";
import {
  transformAgent,
  transformRun,
} from "@/drizzle/schemas/transform-agent-schema";
import { requireSession } from "@/lib/auth/require-session";
import { defineAction } from "@/lib/factories/define-action";
import { inngest } from "@/lib/inngest/client";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Deletes a transform agent for the authenticated user.
 * Runs on server only — never call from client components.
 *
 * @param id - UUID of the agent to delete; must be owned by the authenticated user.
 * @returns Result wrapping void.
 * @author Maruf Bepary
 */
export const deleteTransformAgent = defineAction(
  async (id: string): Promise<Result<void, CommonError>> => {
    const session = await requireSession();
    const validatedAgentId = id;

    const activeRuns = await db
      .select({ id: transformRun.id })
      .from(transformRun)
      .where(
        and(
          eq(transformRun.agentId, validatedAgentId),
          inArray(transformRun.status, [
            "running",
            "paused",
            "waiting_approval",
            "awaiting_review",
          ] as any),
        ),
      );

    if (activeRuns.length > 0) {
      await inngest.send(
        activeRuns.map((r) => ({
          name: "workflows/transform.cancel",
          data: { runId: r.id },
        })),
      );
    }

    await db
      .delete(transformAgent)
      .where(
        and(
          eq(transformAgent.id, validatedAgentId),
          eq(transformAgent.userId, session.user.id),
        ),
      );

    return ok(undefined);
  },
);
