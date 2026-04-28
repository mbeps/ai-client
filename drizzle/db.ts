import { env } from "@/lib/env";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

/**
 * Drizzle ORM database client configured with full application schema.
 * Uses node-postgres driver and DATABASE_URL environment variable for connection string.
 * Must be initialised before any Server Action or API route uses database queries.
 * Schema includes auth tables (user, session, account, verification, twoFactor, passkey) and app tables (chat, message, attachment, project, assistant, prompt, mcpServer).
 *
 * @see schema.ts for exported table definitions.
 * @author Maruf Bepary
 */
export const db = drizzle(env.DATABASE_URL, { schema });
