import { z } from "zod";

/**
 * Zod schema for environment variable validation.
 * This ensures that the application fails fast if critical environment variables are missing
 * or misconfigured.
 *
 * @author Maruf Bepary
 */
const envSchema = z.object({
  // Database
  DATABASE_URL: z.string().url(),

  // Auth
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.string().url(),
  CLIENT_ID_GITHUB: z.string().optional(),
  CLIENT_SECRET_GITHUB: z.string().optional(),
  CLIENT_ID_DISCORD: z.string().optional(),
  CLIENT_SECRET_DISCORD: z.string().optional(),

  // AI
  OPENROUTER_API_KEY: z.string().min(1),

  // Email
  POSTMARK_SERVER_TOKEN: z.string().min(1),
  POSTMARK_FROM_EMAIL: z.string().email(),

  // Storage
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string().default("us-east-1"),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string().default("ai-client-uploads"),

  // App
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
});

/**
 * Validated environment variables.
 * Import this throughout the server-side code instead of accessing `process.env` directly.
 */
export const env = envSchema.parse(process.env);
