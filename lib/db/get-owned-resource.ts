import { db } from "@/drizzle/db";
import { whereOwner } from "./where-owner";
import { verifyOwnership } from "./verify-ownership";

/**
 * Fetches an owned resource and verifies ownership in a single step.
 *
 * @param table - The Drizzle table object
 * @param id - The ID of the resource
 * @param userId - The ID of the authenticated user
 * @returns The retrieved resource
 */
export async function getOwnedResource<T extends { userId: string }>(
  table: any,
  id: string,
  userId: string,
): Promise<T> {
  const [row] = await db
    .select()
    .from(table)
    .where(whereOwner(table, id, userId));
  return verifyOwnership(row as T | undefined | null, userId);
}
