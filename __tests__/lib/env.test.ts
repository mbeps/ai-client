import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * lib/env.ts parses process.env at import time, so each case resets the
 * module registry and sets env vars before a dynamic import.
 */
async function importEnv(envVars: Record<string, string>) {
  vi.resetModules();
  // Required vars from schema; tests only care about the new tunables
  const base: Record<string, string> = {
    DATABASE_URL: "postgres://user:pass@localhost:5432/db",
    BETTER_AUTH_SECRET: "secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    POSTMARK_SERVER_TOKEN: "token",
    POSTMARK_FROM_EMAIL: "from@example.com",
    ENCRYPTION_SECRET: "secret",
    S3_ENDPOINT: "http://localhost:9000",
    S3_REGION: "us-east-1",
    S3_ACCESS_KEY: "key",
    S3_SECRET_KEY: "secret",
    S3_BUCKET: "bucket",
    ...envVars,
  };
  for (const [k, v] of Object.entries(base)) {
    process.env[k] = v;
  }
  // Force the server branch of lib/env (jsdom defines `window`)
  const win = globalThis.window;
  // @ts-expect-error test-only
  delete globalThis.window;
  try {
    return await import("@/lib/env");
  } finally {
    globalThis.window = win;
  }
}

const newVars = [
  "EMBEDDING_DIMENSIONS",
  "EMBEDDING_BATCH_SIZE",
  "CHAT_MAX_HISTORY_TURNS",
  "RAG_TOP_K",
  "TRANSFORM_TOP_K",
  "MAX_DOCUMENT_CHARS",
  "DEFAULT_CHUNK_SIZE",
  "DEFAULT_CHUNK_OVERLAP",
  "CHAT_MAX_STEPS",
  "S3_FORCE_PATH_STYLE",
  "RATE_LIMIT_CHAT_RPM",
  "RATE_LIMIT_UPLOAD_RPM",
] as const;

const expectedDefaults: Record<(typeof newVars)[number], number | boolean> = {
  EMBEDDING_DIMENSIONS: 2048,
  EMBEDDING_BATCH_SIZE: 96,
  CHAT_MAX_HISTORY_TURNS: 50,
  RAG_TOP_K: 5,
  TRANSFORM_TOP_K: 3,
  MAX_DOCUMENT_CHARS: 500000,
  DEFAULT_CHUNK_SIZE: 1600,
  DEFAULT_CHUNK_OVERLAP: 200,
  CHAT_MAX_STEPS: 10,
  S3_FORCE_PATH_STYLE: true,
  RATE_LIMIT_CHAT_RPM: 20,
  RATE_LIMIT_UPLOAD_RPM: 30,
};

describe("env new tunables", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("parses defaults when vars absent", async () => {
    const { env } = await importEnv({});
    for (const name of newVars) {
      expect(env[name]).toBe(expectedDefaults[name]);
    }
  });

  it("parses numeric strings to numbers", async () => {
    const { env } = await importEnv({ EMBEDDING_DIMENSIONS: "1536" });
    expect(env.EMBEDDING_DIMENSIONS).toBe(1536);
  });

  it("parses S3_FORCE_PATH_STYLE=false to boolean false", async () => {
    const { env } = await importEnv({ S3_FORCE_PATH_STYLE: "false" });
    expect(env.S3_FORCE_PATH_STYLE).toBe(false);
  });
});
