"use server";

import type { z } from "zod";
import { updateAgentForUser } from "@/lib/agents/agent-service";
import { requireSession } from "@/lib/auth/require-session";
import { defineAction } from "@/lib/factories/define-action";
import type { updateAgentSchema } from "@/schemas/agent/agent";
import type { AgentRow } from "@/types/agent/agent-row";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Updates an existing custom Agent owned by the authenticated user.
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
    return updateAgentForUser(session.user.id, id, data);
  },
);
