import { afterEach, describe, expect, it, vi } from "vitest";

describe("config/env", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("throws when required server env vars are missing or invalid", async () => {
    vi.resetModules();
    vi.stubEnv("DATABASE_URL", "not-a-url");

    await expect(import("@/config/env")).rejects.toThrow();
  });

  it("clamps EMBEDDING_BATCH_SIZE and CHAT_MAX_APPROVAL_ROUNDS to minimum 1", async () => {
    vi.resetModules();
    vi.stubEnv("EMBEDDING_BATCH_SIZE", "0");
    vi.stubEnv("CHAT_MAX_APPROVAL_ROUNDS", "-5");

    const { env } = await import("@/config/env");
    expect(env.EMBEDDING_BATCH_SIZE).toBe(1);
    expect(env.CHAT_MAX_APPROVAL_ROUNDS).toBe(1);
  });

  it("validates RAG_MODE enum and transforms NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD", async () => {
    vi.resetModules();
    vi.stubEnv("RAG_MODE", "vector");
    vi.stubEnv("NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD", "false");

    const { env } = await import("@/config/env");
    expect(env.RAG_MODE).toBe("vector");
    expect(env.NEXT_PUBLIC_ENABLE_EMAIL_PASSWORD).toBe(false);

    vi.resetModules();
    vi.stubEnv("RAG_MODE", "invalid-mode");
    await expect(import("@/config/env")).rejects.toThrow();
  });

  it("handles LOG_LEVEL warn, empty QDRANT_* strings, and client-only parseEnv", async () => {
    vi.resetModules();
    vi.stubEnv("LOG_LEVEL", "warn");
    vi.stubEnv("QDRANT_API_KEY", "");

    const { env } = await import("@/config/env");
    expect(env.LOG_LEVEL).toBe("warning");
    expect(env.QDRANT_API_KEY).toBeUndefined();

    vi.resetModules();
    vi.stubEnv("NODE_ENV", "production");
    vi.stubGlobal("window", {});
    const { env: clientOnly } = await import("@/config/env");
    expect(clientOnly.NODE_ENV).toBe("production");
    vi.unstubAllGlobals();

    vi.resetModules();
    vi.stubEnv("RAG_MODE", "hybrid");
    vi.stubEnv("QDRANT_URL", "");
    await expect(import("@/config/env")).rejects.toThrow();
  });
});
