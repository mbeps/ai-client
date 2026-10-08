"use server";

import { requireSession } from "@/lib/auth/require-session";
import { updateMemoryForUser } from "@/lib/memory/memory-service";
import {
  type UpdateMemoryInput,
  updateMemorySchema,
} from "@/schemas/memory/memory";
import type { Memory } from "@/types/memory/memory";

/**
 * Updates an existing memory item for the authenticated user.
 *
 * @param input - UpdateMemoryInput containing id and content
 * @returns The updated Memory object
 * @author Maruf Bepary
 */
export async function updateMemory(input: UpdateMemoryInput): Promise<Memory> {
  const session = await requireSession();
  const parsed = updateMemorySchema.parse(input);

  return updateMemoryForUser(session.user.id, parsed.id, parsed.content);
}
