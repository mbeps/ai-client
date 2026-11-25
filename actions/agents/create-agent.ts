"use server";

import type { z } from "zod";
import { createAgentForUser } from "@/lib/agents/agent-service";
import { requireSession } from "@/lib/auth/require-session";
import { defineAction } from "@/lib/factories/define-action";
import type { createAgentSchema } from "@/schemas/agent/agent";
import type { AgentRow } from "@/types/agent/agent-row";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";

/**
 * Creates a new unified Agent for the authenticated user.
 *
 * @param data - Agent configuration validated against `createAgentSchema`.
 * @returns Result wrapping the newly created `AgentRow`.
 */
export const createAgent = defineAction(
  async (
    data: z.input<typeof createAgentSchema>,
  ): Promise<Result<AgentRow, CommonError>> => {
    const session = await requireSession();
    return createAgentForUser(session.user.id, data);
  },
);
