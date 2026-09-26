import { defineConfig } from "drizzle-kit";
import { env } from "./config/env";

/**
 * Drizzle CLI configuration that points to the Better Auth schema.
 */
export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: env.DATABASE_URL,
  },
});
