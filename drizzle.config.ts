import { defineConfig } from "drizzle-kit"

/**
 * Drizzle CLI configuration that points to the Better Auth schema.
 */
export default defineConfig({
  schema: "./drizzle/schema.ts",
  out: "./drizzle/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
})
