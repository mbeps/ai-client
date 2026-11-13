"use server";

import type { z } from "zod";
import { DEFAULT_ENABLED_TOOLS } from "@/config/tools";
import { db } from "@/drizzle/db";
import {
  agent,
  DEFAULT_AGENT_GUARDRAILS,
} from "@/drizzle/schemas/agent-schema";
import { validateTargetSubagentIds } from "@/lib/agents/validate-subagent-links";
import { requireSession } from "@/lib/auth/require-session";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { getLogger } from "@/lib/logger";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import { createAgentSchema } from "@/schemas/agent/agent";
import type { AgentRow } from "@/types/agent/agent-row";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

const log = getLogger(["app", "actions", "agent"]);

/**
 * Creates a new unified Agent for the authenticated user.
 * Enforces Rule 1 of the 2-layer graph invariant when `subagentIds` are provided.
 *
 * @param data - Agent configuration validated against `createAgentSchema`.
 * @returns Result wrapping the newly created `AgentRow`.
 */
export const createAgent = defineAction(
  async (
    data: z.input<typeof createAgentSchema>,
  ): Promise<Result<AgentRow, CommonError>> => {
    const session = await requireSession();

    const parsed = createAgentSchema.safeParse(data);
    if (!parsed.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: parsed.error.issues[0].message,
      });
    }

    const validated = parsed.data;
    const subagentIds = validated.subagentIds ?? [];
    if (subagentIds.length > 0) {
      const linkCheck = await validateTargetSubagentIds(
        session.user.id,
        subagentIds,
      );
      if (!linkCheck.ok) {
        return linkCheck;
      }
    }

    const [row] = await db
      .insert(agent)
      .values({
        userId: session.user.id,
        name: validated.name,
        description: validated.description ?? null,
        prompt: validated.prompt ?? null,
        subagentPrompt: validated.subagentPrompt ?? null,
        modelId: validated.modelId ?? null,
        knowledgebaseIds: validated.knowledgebaseIds ?? [],
        tools: validated.tools ?? [...DEFAULT_ENABLED_TOOLS],
        skillMode: validated.skillMode,
        skillIds: validated.skillIds,
        promptMode: validated.promptMode,
        promptIds: validated.promptIds,
        subagentIds,
        guardrails: validated.guardrails ?? DEFAULT_AGENT_GUARDRAILS,
        avatar: validated.avatar ?? null,
      })
      .returning();

    log.info("Created Agent (id: {id})", {
      id: row.id,
      name: row.name,
      userId: session.user.id,
    });

    return ok(row);
  },
);
