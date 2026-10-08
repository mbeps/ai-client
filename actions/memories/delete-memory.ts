"use server";

import { requireSession } from "@/lib/auth/require-session";
import { deleteMemoryForUser } from "@/lib/memory/memory-service";
import {
  type DeleteMemoryInput,
  deleteMemorySchema,
} from "@/schemas/memory/memory";

/**
 * Deletes a memory item owned by the authenticated user.
 *
 * @param input - DeleteMemoryInput containing memory id
 * @author Maruf Bepary
 */
export async function deleteMemory(input: DeleteMemoryInput): Promise<void> {
  const session = await requireSession();
  const parsed = deleteMemorySchema.parse(input);

  await deleteMemoryForUser(session.user.id, parsed.id);
}
