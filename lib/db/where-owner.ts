import { and, eq, inArray } from "drizzle-orm";

/**
 * Common ownership check helper for Drizzle queries.
 * Returns a filter expression that matches the item ID and the user's ID.
 *
 * @param table - The Drizzle table object (must have .id and .userId columns)
 * @param idOrIds - The ID or IDs of the resources being accessed
 * @param userId - The ID of the authenticated user
 * @returns An 'and' expression for ownership validation
 */
export function whereOwner(
  table: any,
  idOrIds: string | string[],
  userId: string,
) {
  const ids = Array.isArray(idOrIds) ? idOrIds : [idOrIds];
  return and(inArray(table.id, ids), eq(table.userId, userId));
}
