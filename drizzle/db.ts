import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

/**
 * Drizzle ORM database client configured with the full application schema.
 * Reads DATABASE_URL from the environment; must be set before the server starts.
 *
 * @author Maruf Bepary
 */
export const db = drizzle(process.env.DATABASE_URL!, { schema });
