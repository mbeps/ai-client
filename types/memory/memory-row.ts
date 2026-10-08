import type { userMemory } from "@/drizzle/schemas/user-memory-schema";

/**
 * Direct database select row type for the user_memory table.
 *
 * @author Maruf Bepary
 */
export type UserMemoryRow = typeof userMemory.$inferSelect;
