import { z } from "zod";

/**
 * Zod validation schema for client-accessible environment variables.
 * Only NEXT_PUBLIC_* variables belong here.
 *
 * @author Maruf Bepary
 */
export const clientEnvSchema = z.object({
  NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD: z
    .string()
    .default("true")
    .transform((v) => v === "true"),
});

/**
 * Zod validation schema for server environment variables.
 * Extends client schema with database URL, auth secrets, API keys, and storage configuration.
 *
 * @author Maruf Bepary
 */
export const serverEnvSchema = clientEnvSchema.extend({
  // Database
  DATABASE_URL: z.string().url(),

  // Auth
  BETTER_AUTH_SECRET: z.string().min(1),
  BETTER_AUTH_URL: z.string().url(),
  CLIENT_ID_GITHUB: z.string().optional(),
  CLIENT_SECRET_GITHUB: z.string().optional(),
  CLIENT_ID_DISCORD: z.string().optional(),
  CLIENT_SECRET_DISCORD: z.string().optional(),
  CLIENT_ID_GOOGLE: z.string().optional(),
  CLIENT_SECRET_GOOGLE: z.string().optional(),

  // AI
  EMBEDDING_DIMENSIONS: z
    .string()
    .default("2048")
    .transform((v) => parseInt(v, 10)),
  EMBEDDING_BATCH_SIZE: z
    .string()
    .default("96")
    .transform((v) => parseInt(v, 10))
    // A batch size < 1 would make the batching loop in embed-documents spin
    // forever; clamp to a safe minimum at the trust boundary.
    .transform((v) => Math.max(1, v)),
  CHAT_MAX_HISTORY_TURNS: z
    .string()
    .default("50")
    .transform((v) => parseInt(v, 10)),
  RAG_TOP_K: z
    .string()
    .default("5")
    .transform((v) => parseInt(v, 10)),
  TRANSFORM_TOP_K: z
    .string()
    .default("3")
    .transform((v) => parseInt(v, 10)),
  MAX_DOCUMENT_CHARS: z
    .string()
    .default("500000")
    .transform((v) => parseInt(v, 10)),
  DEFAULT_CHUNK_SIZE: z
    .string()
    .default("1600")
    .transform((v) => parseInt(v, 10)),
  DEFAULT_CHUNK_OVERLAP: z
    .string()
    .default("200")
    .transform((v) => parseInt(v, 10)),
  CHAT_MAX_STEPS: z
    .string()
    .default("10")
    .transform((v) => parseInt(v, 10)),
  RATE_LIMIT_CHAT_RPM: z
    .string()
    .default("20")
    .transform((v) => parseInt(v, 10)),
  RATE_LIMIT_UPLOAD_RPM: z
    .string()
    .default("30")
    .transform((v) => parseInt(v, 10)),

  // Email
  POSTMARK_SERVER_TOKEN: z.string().min(1),
  POSTMARK_FROM_EMAIL: z.string().email(),

  // Encryption
  ENCRYPTION_SECRET: z.string().min(1),

  // Storage
  S3_FORCE_PATH_STYLE: z
    .string()
    .default("true")
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
  LOG_LEVEL: z
    .enum(["debug", "info", "warn", "warning", "error", "fatal"])
    .default("info")
    .transform((val) => (val === "warn" ? "warning" : val)),
  ALLOW_PRIVATE_NETWORK_MCP: z
    .string()
    .default("false")
    .transform((v) => v === "true"),
  PRESIGNED_URL_EXPIRY_SECONDS: z
    .string()
    .default("3600")
    .transform((v) => parseInt(v, 10)),

  // Inngest
  INNGEST_BASE_URL: z.string().optional(),
  INNGEST_EVENT_KEY: z.string().optional(),
  INNGEST_SIGNING_KEY: z.string().optional(),
  INNGEST_DEV: z.string().optional(),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type Env = ServerEnv;

/**
 * Validates environment variables according to active runtime context.
 * Pass explicit process.env keys so Next.js bundlers can inline NEXT_PUBLIC_* variables.
 *
 * @param runtimeEnv Optional explicit environment key-value map.
 * @param isServerEnv Flag indicating whether to validate server environment variables.
 * @returns Validated environment configuration object.
 */
export function validateEnv(
  runtimeEnv?: Record<string, unknown>,
  isServerEnv: boolean = typeof window === "undefined" ||
    process.env.NODE_ENV === "test",
): Env {
  const defaultEnv: Record<string, unknown> = isServerEnv
    ? {
        NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD:
          process.env.NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD,
        DATABASE_URL: process.env.DATABASE_URL,
        BETTER_AUTH_SECRET: process.env.BETTER_AUTH_SECRET,
        BETTER_AUTH_URL: process.env.BETTER_AUTH_URL,
        CLIENT_ID_GITHUB: process.env.CLIENT_ID_GITHUB,
        CLIENT_SECRET_GITHUB: process.env.CLIENT_SECRET_GITHUB,
        CLIENT_ID_DISCORD: process.env.CLIENT_ID_DISCORD,
        CLIENT_SECRET_DISCORD: process.env.CLIENT_SECRET_DISCORD,
        CLIENT_ID_GOOGLE: process.env.CLIENT_ID_GOOGLE,
        CLIENT_SECRET_GOOGLE: process.env.CLIENT_SECRET_GOOGLE,
        EMBEDDING_DIMENSIONS: process.env.EMBEDDING_DIMENSIONS,
        EMBEDDING_BATCH_SIZE: process.env.EMBEDDING_BATCH_SIZE,
        CHAT_MAX_HISTORY_TURNS: process.env.CHAT_MAX_HISTORY_TURNS,
        RAG_TOP_K: process.env.RAG_TOP_K,
        TRANSFORM_TOP_K: process.env.TRANSFORM_TOP_K,
        MAX_DOCUMENT_CHARS: process.env.MAX_DOCUMENT_CHARS,
        DEFAULT_CHUNK_SIZE: process.env.DEFAULT_CHUNK_SIZE,
        DEFAULT_CHUNK_OVERLAP: process.env.DEFAULT_CHUNK_OVERLAP,
        CHAT_MAX_STEPS: process.env.CHAT_MAX_STEPS,
        RATE_LIMIT_CHAT_RPM: process.env.RATE_LIMIT_CHAT_RPM,
        RATE_LIMIT_UPLOAD_RPM: process.env.RATE_LIMIT_UPLOAD_RPM,
        POSTMARK_SERVER_TOKEN: process.env.POSTMARK_SERVER_TOKEN,
        POSTMARK_FROM_EMAIL: process.env.POSTMARK_FROM_EMAIL,
        ENCRYPTION_SECRET: process.env.ENCRYPTION_SECRET,
        S3_FORCE_PATH_STYLE: process.env.S3_FORCE_PATH_STYLE,
        S3_ENDPOINT: process.env.S3_ENDPOINT,
        S3_REGION: process.env.S3_REGION,
        S3_ACCESS_KEY: process.env.S3_ACCESS_KEY,
        S3_SECRET_KEY: process.env.S3_SECRET_KEY,
        S3_BUCKET: process.env.S3_BUCKET,
        NODE_ENV: process.env.NODE_ENV,
        LOG_LEVEL: process.env.LOG_LEVEL,
        ALLOW_PRIVATE_NETWORK_MCP: process.env.ALLOW_PRIVATE_NETWORK_MCP,
        PRESIGNED_URL_EXPIRY_SECONDS: process.env.PRESIGNED_URL_EXPIRY_SECONDS,
        INNGEST_BASE_URL: process.env.INNGEST_BASE_URL,
        INNGEST_EVENT_KEY: process.env.INNGEST_EVENT_KEY,
        INNGEST_SIGNING_KEY: process.env.INNGEST_SIGNING_KEY,
        INNGEST_DEV: process.env.INNGEST_DEV,
      }
    : {
        NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD:
          process.env.NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD,
      };

  const schema = isServerEnv ? serverEnvSchema : clientEnvSchema;
  const parsed = schema.safeParse(runtimeEnv ?? defaultEnv);

  if (!parsed.success) {
    console.error("❌ Invalid environment variables:", parsed.error.format());
    throw new Error("Invalid environment variables");
  }

  return parsed.data as Env;
}

/**
 * Validated environment variables parsed from process.env.
 * Import this instead of accessing process.env directly to ensure type safety
 * and runtime validation.
 *
 * @example
 * import { env } from "@/config/env";
 * const dbUrl = env.DATABASE_URL;
 * @author Maruf Bepary
 */
export const env = validateEnv();
