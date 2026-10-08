"use server";

import { revalidatePath } from "next/cache";
import { ROUTES } from "@/config/routes";
import { requireSession } from "@/lib/auth/require-session";
import { deleteMemoriesForUser } from "@/lib/memory/memory-service";
import {
  type DeleteMemoriesInput,
  deleteMemoriesSchema,
} from "@/schemas/memory/memory";

/**
 * Deletes one or multiple memory items owned by the authenticated user.
 *
 * @param input - DeleteMemoriesInput containing array of memory IDs
 * @author Maruf Bepary
 */
export async function deleteMemories(
  input: DeleteMemoriesInput,
): Promise<void> {
  const session = await requireSession();
  const parsed = deleteMemoriesSchema.parse(input);

  await deleteMemoriesForUser(session.user.id, parsed.ids);

  revalidatePath(ROUTES.SETTINGS.MEMORY.path);
}
