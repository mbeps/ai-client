"use server";

import { z } from "zod";
import { isBuiltInAgentId } from "@/config/built-in-agents";
import { db } from "@/drizzle/db";
import { agent } from "@/drizzle/schemas/agent-schema";
import {
  validateAgentCanBecomeOrchestrator,
  validateTargetSubagentIds,
} from "@/lib/agents/validate-subagent-links";
import { requireSession } from "@/lib/auth/require-session";
import { whereOwner } from "@/lib/db/where-owner";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { getLogger } from "@/lib/logger";
import { fail } from "@/lib/result/fail";
import { ok } from "@/lib/result/ok";
import { updateAgentSchema } from "@/schemas/agent/agent";
import type { AgentRow } from "@/types/agent/agent-row";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

const log = getLogger(["app", "actions", "agent"]);

function buildAgentUpdateValues(
  data: z.infer<typeof updateAgentSchema>,
): Record<string, unknown> {
  const values: Record<string, unknown> = { updatedAt: new Date() };
  if (data.name !== undefined) values.name = data.name;
  if (data.description !== undefined) values.description = data.description;
  if (data.prompt !== undefined) values.prompt = data.prompt;
  if (data.subagentPrompt !== undefined)
    values.subagentPrompt = data.subagentPrompt;
  if (data.modelId !== undefined) values.modelId = data.modelId;
  if (data.knowledgebaseIds !== undefined)
    values.knowledgebaseIds = data.knowledgebaseIds;
  if (data.tools !== undefined) values.tools = data.tools;
  if (data.skillMode !== undefined) values.skillMode = data.skillMode;
  if (data.skillIds !== undefined) values.skillIds = data.skillIds;
  if (data.promptMode !== undefined) values.promptMode = data.promptMode;
  if (data.promptIds !== undefined) values.promptIds = data.promptIds;
  if (data.subagentIds !== undefined) values.subagentIds = data.subagentIds;
  if (data.guardrails !== undefined) values.guardrails = data.guardrails;
  if (data.avatar !== undefined) values.avatar = data.avatar;
  return values;
}

/**
 * Updates an existing custom Agent owned by the authenticated user.
 * Enforces immutability for built-in agents and both 2-layer graph invariant rules
 * whenever `subagentIds` is set to a non-empty array.
 *
 * @param id - UUID of the custom agent to update.
 * @param data - Partial update payload validated against `updateAgentSchema`.
 * @returns Result wrapping the updated `AgentRow`.
 */
export const updateAgent = defineAction(
  async (
    id: string,
    data: z.input<typeof updateAgentSchema>,
  ): Promise<Result<AgentRow, CommonError>> => {
    const session = await requireSession();

    if (isBuiltInAgentId(id)) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: "Built-in agents cannot be modified",
      });
    }

    const idParsed = z.string().uuid().safeParse(id);
    if (!idParsed.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: "Invalid entity ID format",
      });
    }
    const validatedId = idParsed.data;

    const dataParsed = updateAgentSchema.safeParse(data);
    if (!dataParsed.success) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: dataParsed.error.issues[0].message,
      });
    }
    const validatedData = dataParsed.data;

    if (validatedData.subagentIds && validatedData.subagentIds.length > 0) {
      const targetCheck = await validateTargetSubagentIds(
        session.user.id,
        validatedData.subagentIds,
        validatedId,
      );
      if (!targetCheck.ok) {
        return targetCheck;
      }

      const orchestratorCheck = await validateAgentCanBecomeOrchestrator(
        session.user.id,
        validatedId,
      );
      if (!orchestratorCheck.ok) {
        return orchestratorCheck;
      }
    }

    const [row] = await db
      .update(agent)
      .set(buildAgentUpdateValues(validatedData))
      .where(whereOwner(agent, validatedId, session.user.id))
      .returning();

    if (!row) {
      return fail({
        code: ERROR_CODE.NOT_FOUND,
        message: "Not Found",
      });
    }

    log.info("Updated Agent (id: {id})", {
      id: validatedId,
      userId: session.user.id,
    });

    return ok(row);
  },
);
