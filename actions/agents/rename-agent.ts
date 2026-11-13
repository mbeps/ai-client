"use server";

import { isBuiltInAgentId } from "@/config/built-in-agents";
import { agent } from "@/drizzle/schemas/agent-schema";
import { ERROR_CODE } from "@/lib/error/error-code";
import { defineAction } from "@/lib/factories/define-action";
import { renameEntityFactory } from "@/lib/factories/rename-entity-factory";
import { fail } from "@/lib/result/fail";
import { renameAgentSchema } from "@/schemas/agent/agent";
import type { AgentRow } from "@/types/agent/agent-row";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

const renameCustomAgent = renameEntityFactory<AgentRow>({
  table: agent,
  nameSchema: renameAgentSchema.shape.name,
});

/**
 * Renames a custom Agent owned by the authenticated user.
 * Rejects attempts to rename read-only built-in system agents.
 *
 * @param id - UUID of the custom agent to rename.
 * @param name - New display name validated against `renameAgentSchema`.
 * @returns Result wrapping the updated `AgentRow`.
 */
export const renameAgent = defineAction(
  async (id: string, name: string): Promise<Result<AgentRow, CommonError>> => {
    if (isBuiltInAgentId(id)) {
      return fail({
        code: ERROR_CODE.INVALID_INPUT,
        message: "Built-in agents cannot be modified",
      });
    }
    return renameCustomAgent(id, name);
  },
);
