import { desc, eq, type SQL } from "drizzle-orm";
import { db } from "@/drizzle/db";
import { requireSession } from "@/lib/auth/require-session";

export interface ListOwnedResourcesOptions<TTable> {
  /**
   * Custom order by logic. Defaults to [desc(table.updatedAt)] if available.
   */
  orderBy?: (table: TTable) => SQL[] | SQL;

  /**
   * Pagination limit.
   */
  limit?: number;

  /**
   * Pagination offset.
   */
  offset?: number;
}

/**
 * Generic utility for listing resources owned by the current session user.
 *
 * @param table - The Drizzle table object (must have .userId and .updatedAt columns for defaults)
 * @param options - Pagination and ordering options
 * @returns Array of user-owned resources
 * @author Maruf Bepary
 */
export async function listOwnedResources<TTable, TRow = any>(
  table: TTable,
  options: ListOwnedResourcesOptions<TTable> = {},
): Promise<TRow[]> {
  const session = await requireSession();
  const userId = session.user.id;

  const { orderBy, limit, offset } = options;

  let query = db
    .select()
    .from(table as any)
    .where(eq((table as any).userId, userId))
    .$dynamic();

  if (orderBy) {
    const orders = orderBy(table);
    if (Array.isArray(orders)) {
      query = query.orderBy(...orders);
    } else {
      query = query.orderBy(orders);
    }
  } else if ("updatedAt" in (table as any)) {
    // ponytail: assuming table has updatedAt if no orderBy is provided
    query = query.orderBy(desc((table as any).updatedAt));
  }

  if (limit !== undefined) {
    query = query.limit(limit);
  }

  if (offset !== undefined) {
    query = query.offset(offset);
  }

  return (await query) as TRow[];
}
