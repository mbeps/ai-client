"use server";

import { requireSession } from "@/lib/auth/require-session";
import { saveMemoryForUser } from "@/lib/memory/memory-service";
import {
  type CreateMemoryInput,
  createMemorySchema,
} from "@/schemas/memory/memory";
import type { Memory } from "@/types/memory/memory";

/**
 * Creates a new memory item for the authenticated user.
 *
 * @param input - CreateMemoryInput containing memory content
 * @returns The created Memory object
 * @author Maruf Bepary
 */
export async function createMemory(input: CreateMemoryInput): Promise<Memory> {
  const session = await requireSession();
  const parsed = createMemorySchema.parse(input);

  return saveMemoryForUser(session.user.id, parsed.content);
}
