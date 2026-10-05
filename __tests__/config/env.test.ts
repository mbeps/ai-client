import { afterEach, describe, expect, it, vi } from "vitest";
import { clientEnvSchema, env, serverEnvSchema, validateEnv } from "@/config/env";

const baseRequiredServerEnv = {
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
};

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

describe("env configuration and validation", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("server env validation", () => {
    it("parses defaults when optional tunables are absent", () => {
      const parsed = validateEnv(baseRequiredServerEnv, true);
      for (const name of newVars) {
        expect(parsed[name]).toBe(expectedDefaults[name]);
      }
    });

    it("parses numeric strings to numbers", () => {
      const parsed = validateEnv(
        {
          ...baseRequiredServerEnv,
          EMBEDDING_DIMENSIONS: "1536",
        },
        true,
      );
      expect(parsed.EMBEDDING_DIMENSIONS).toBe(1536);
    });

    it("parses S3_FORCE_PATH_STYLE=false to boolean false", () => {
      const parsed = validateEnv(
        {
          ...baseRequiredServerEnv,
          S3_FORCE_PATH_STYLE: "false",
        },
        true,
      );
      expect(parsed.S3_FORCE_PATH_STYLE).toBe(false);
    });

    it("throws error when critical server variables are missing", () => {
      expect(() =>
        validateEnv(
          {
            ...baseRequiredServerEnv,
            DATABASE_URL: "not-a-valid-url",
          },
          true,
        ),
      ).toThrow("Invalid environment variables");
    });
  });

  describe("client env validation", () => {
    it("validates client variables with defaults when isServerEnv is false", () => {
      const parsed = validateEnv({}, false);
      expect(parsed.NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD).toBe(true);
    });

    it("parses NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD=false correctly", () => {
      const parsed = validateEnv(
        { NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD: "false" },
        false,
      );
      expect(parsed.NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD).toBe(false);
    });
  });

  describe("schemas and singleton", () => {
    it("exports valid schemas and singleton instance", () => {
      expect(clientEnvSchema).toBeDefined();
      expect(serverEnvSchema).toBeDefined();
      expect(env).toBeDefined();
    });
  });
});

