"use server";

import { transformAgent } from "@/drizzle/schemas/transform-agent-schema";
import { requireSession } from "@/lib/auth/require-session";
import { getOwnedResource } from "@/lib/db/get-owned-resource";
import { defineAction } from "@/lib/factories/define-action";
import { ok } from "@/lib/result/ok";
import type { CommonError } from "@/types/error/common-error";
import type { Result } from "@/types/result";
import type { TransformAgentRow } from "@/types/transform/transform-agent-row";

/**
 * Fetches a single transform agent with its full configuration for the authenticated user.
 * Validates agent ownership before returning data.
 * Returns parsed steps array and bound tool/knowledge base IDs.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param id - UUID of the agent to retrieve; must be owned by the authenticated user.
 * @returns Result wrapping transform agent record or null.
 * @author Maruf Bepary
 */
export const getTransformAgent = defineAction(
  async (
    id: string,
  ): Promise<Result<TransformAgentRow | null, CommonError>> => {
    const session = await requireSession();
    const row = await getOwnedResource<TransformAgentRow>(
      transformAgent,
      id,
      session.user.id,
    );
    return ok(row);
  },
);
