"use server";

import { transformAgent } from "@/drizzle/schema";
import { renameTransformAgentSchema } from "@/schemas/workflows/transform-agent";
import { renameEntityFactory } from "@/lib/actions/shared/rename-entity-factory";

/**
 * Renames a Transform Agent.
 * Follows the centralized rename pattern used for chats, projects, and assistants.
 *
 * @param id - The ID of the agent to rename.
 * @param name - The new name for the agent.
 * @author Maruf Bepary
 */
export const renameTransformAgent = renameEntityFactory({
  table: transformAgent,
  nameSchema: renameTransformAgentSchema.shape.name,
});
