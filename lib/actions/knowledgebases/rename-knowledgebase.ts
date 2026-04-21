"use server";

import { requireSession } from "@/lib/actions/require-session";
import { db } from "@/drizzle/db";

/**
 * Renames a knowledgebase in the database.
 *
 * @param kbId - Unique identifier of the knowledgebase.
 * @param name - The new name for the knowledgebase.
 * @returns The updated knowledgebase record (mocked for now).
 */
export async function renameKnowledgebase(kbId: string, name: string) {
  const session = await requireSession();

  console.log(`Renaming knowledgebase ${kbId} to ${name}`);
  return { id: kbId, name, updatedAt: new Date() };
}
