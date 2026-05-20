import { and, eq } from "drizzle-orm";

/**
 * Common ownership check helper for Drizzle queries.
 * Returns a filter expression that matches the item ID and the user's ID.
 *
 * @param table - The Drizzle table object (must have .id and .userId columns)
 * @param id - The ID of the resource being accessed
 * @param userId - The ID of the authenticated user
 * @returns An 'and' expression for ownership validation
 */
export function whereOwner(table: any, id: string, userId: string) {
  return and(eq(table.id, id), eq(table.userId, userId));
}

/**
 * Standard ownership verification after a database read.
 * Throws consistent errors for non-existent or unauthorized access.
 *
 * @param row - The retrieved database record (or undefined/null)
 * @param userId - The ID of the authenticated user (optional - if row has userId, it will be checked)
 * @returns The row if valid
 * @throws Error "Not Found" if row is missing or user doesn't own it
 */
export function verifyOwnership<T extends { userId: string }>(
  row: T | undefined | null,
  userId?: string,
): T {
  if (!row) {
    throw new Error("Not Found");
  }

  if (userId && row.userId !== userId) {
    throw new Error("Not Found");
  }

  return row;
}
