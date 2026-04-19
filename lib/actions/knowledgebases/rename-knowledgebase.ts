"use server";

import { auth } from "@/lib/auth/auth";
import { db } from "@/drizzle/db";
import { headers } from "next/headers";

/**
 * Renames a knowledgebase in the database.
 *
 * @param kbId - Unique identifier of the knowledgebase.
 * @param name - The new name for the knowledgebase.
 * @returns The updated knowledgebase record (mocked for now).
 */
export async function renameKnowledgebase(kbId: string, name: string) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) throw new Error("Unauthorized");

  console.log(`Renaming knowledgebase ${kbId} to ${name}`);
  return { id: kbId, name, updatedAt: new Date() };
}
