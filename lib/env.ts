import { z } from "zod";

/**
 * Zod validation schema for required environment variables.
 * Ensures the application fails at startup if critical config is missing or invalid.
 * Validates database URL, authentication secrets, API keys, and storage configuration.
 * Optional OAuth credentials (GitHub, Discord) allow graceful fallback if not configured.
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
  EMBEDDING_DIMENSIONS: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 2048)),
  EMBEDDING_BATCH_SIZE: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 96))
    // A batch size < 1 would make the batching loop in embed-documents spin
    // forever; clamp to a safe minimum at the trust boundary.
    .transform((v) => Math.max(1, v)),
  CHAT_MAX_HISTORY_TURNS: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 50)),
  RAG_TOP_K: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 5)),
  TRANSFORM_TOP_K: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 3)),
  MAX_DOCUMENT_CHARS: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 500000)),
  DEFAULT_CHUNK_SIZE: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1600)),
  DEFAULT_CHUNK_OVERLAP: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 200)),
  CHAT_MAX_STEPS: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 10)),
  RATE_LIMIT_CHAT_RPM: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20)),
  RATE_LIMIT_UPLOAD_RPM: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 30)),

  // Email
  POSTMARK_SERVER_TOKEN: z.string().min(1),
  POSTMARK_FROM_EMAIL: z.string().email(),

  // Encryption
  ENCRYPTION_SECRET: z.string().min(1),

  // Storage
  S3_FORCE_PATH_STYLE: z
    .string()
    .optional()
    .transform((v) => v !== "false"),
  S3_ENDPOINT: z.string().url(),
  S3_REGION: z.string(),
  S3_ACCESS_KEY: z.string().min(1),
  S3_SECRET_KEY: z.string().min(1),
  S3_BUCKET: z.string(),

  // App
  NODE_ENV: z
    .enum(["development", "test", "production"])
    .default("development"),
  ALLOW_PRIVATE_NETWORK_MCP: z
    .string()
    .optional()
    .transform((v) => v === "true"),
  PRESIGNED_URL_EXPIRY_SECONDS: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 3600)),
  NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD: z
    .string()
    .optional()
    .default("true")
    .transform((v) => v === "true"),
});

/**
 * Validated environment variables parsed from process.env.
 * Import this instead of accessing process.env directly to ensure type safety
 * and runtime validation. Guaranteed to contain all required variables on server startup.
 *
 * @example
 * import { env } from "@/lib/env";
 * const dbUrl = env.DATABASE_URL;  // Typed as string | undefined (based on schema)
 * @author Maruf Bepary
 */
export const env =
  typeof window === "undefined"
    ? envSchema.parse(process.env)
    : (envSchema.partial().parse({
        NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD:
          process.env.NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD,
      }) as z.infer<typeof envSchema>);
