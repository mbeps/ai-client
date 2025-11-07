import { drizzle } from "drizzle-orm/node-postgres"
import * as schema from "./schema"

/**
 * Drizzle ORM database client configured with the Better Auth schema.
 */
export const db = drizzle(process.env.DATABASE_URL!, { schema })
