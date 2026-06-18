"use server";

import { requireSession } from "@/lib/auth/require-session";
import { db } from "@/drizzle/db";
import { transformAgent } from "@/drizzle/schema";
import { and, eq } from "drizzle-orm";
import { renameTransformAgentSchema } from "@/schemas/workflows/transform-agent";
import { z } from "zod";

/**
 * Renames a Transform Agent.
 * Follows the centralized rename pattern used for chats, projects, and assistants.
 *
 * @param id - The ID of the agent to rename.
 * @param name - The new name for the agent.
 * @author Maruf Bepary
 */
export async function renameTransformAgent(id: string, name: string) {
  const session = await requireSession();

  // Validate inputs
  const validatedId = z.string().uuid().parse(id);
  const { name: validatedName } = renameTransformAgentSchema.parse({ name });

  const [row] = await db
    .update(transformAgent)
    .set({ name: validatedName, updatedAt: new Date() })
    .where(
      and(
        eq(transformAgent.id, validatedId),
        eq(transformAgent.userId, session.user.id),
      ),
    )
    .returning();

  if (!row) throw new Error("Not Found");

  return row;
}
