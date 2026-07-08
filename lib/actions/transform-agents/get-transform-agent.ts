"use server";

import { requireSession } from "@/lib/auth/require-session";
import { transformAgent } from "@/drizzle/schema";
import { getOwnedResource } from "@/lib/db/get-owned-resource";
import type { TransformAgentRow } from "@/types/transform/transform-agent-row";

/**
 * Fetches a single transform agent with its full configuration for the authenticated user.
 * Validates agent ownership before returning data.
 * Returns parsed steps array and bound tool/knowledge base IDs.
 * Runs on server only — invoked from client via Server Action.
 *
 * @param id - UUID of the agent to retrieve; must be owned by the authenticated user.
 * @returns The transform agent record with all configuration.
 * @throws Error if session is not authenticated.
 * @throws Error if agent is not found or user does not own it (returns "Not Found").
 * @throws Error if database query fails due to connection issues.
 * @see listTransformAgents to fetch all agents.
 * @author Maruf Bepary
 */
export async function getTransformAgent(
  id: string,
): Promise<TransformAgentRow | null> {
  const session = await requireSession();
  return getOwnedResource<TransformAgentRow>(
    transformAgent,
    id,
    session.user.id,
  );
}
