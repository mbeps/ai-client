"use server";

import { transformAgent } from "@/drizzle/schemas/transform-agent-schema";
import { renameEntityFactory } from "@/lib/factories/rename-entity-factory";
import { renameTransformAgentSchema } from "@/schemas/workflows/transform-agent";

/**
 * Renames a Transform Agent.
 * Follows the centralized rename pattern used for chats, projects, and assistants.
 *
 * @param id - The ID of the agent to rename.
 * @param name - The new name for the agent.
 */
export const renameTransformAgent = renameEntityFactory({
  table: transformAgent,
  nameSchema: renameTransformAgentSchema.shape.name,
});
