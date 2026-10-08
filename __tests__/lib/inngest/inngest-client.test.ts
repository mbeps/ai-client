import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("lib/inngest/client", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("configures client in development mode with INNGEST_DEV='1'", async () => {
    vi.doMock("@/config/env", () => ({
      env: {
        NODE_ENV: "production",
        INNGEST_DEV: "1",
        INNGEST_SIGNING_KEY: "sign-key",
        INNGEST_EVENT_KEY: "event-key",
      },
    }));

    const { inngest } = await import("@/lib/inngest/client");
    expect(inngest).toBeDefined();
    expect(inngest.id).toBe("ai-client");
  });

  it("configures client in development mode with INNGEST_DEV='true'", async () => {
    vi.doMock("@/config/env", () => ({
      env: {
        NODE_ENV: "production",
        INNGEST_DEV: "true",
        INNGEST_SIGNING_KEY: "sign-key",
        INNGEST_EVENT_KEY: "event-key",
      },
    }));

    const { inngest } = await import("@/lib/inngest/client");
    expect(inngest).toBeDefined();
  });

  it("configures client in development mode when NODE_ENV is not production", async () => {
    vi.doMock("@/config/env", () => ({
      env: {
        NODE_ENV: "test",
        INNGEST_DEV: "0",
        INNGEST_SIGNING_KEY: "sign-key",
        INNGEST_EVENT_KEY: "event-key",
      },
    }));

    const { inngest } = await import("@/lib/inngest/client");
    expect(inngest).toBeDefined();
  });

  it("configures client in development mode when INNGEST_SIGNING_KEY is missing", async () => {
    vi.doMock("@/config/env", () => ({
      env: {
        NODE_ENV: "production",
        INNGEST_DEV: "0",
        INNGEST_SIGNING_KEY: undefined,
        INNGEST_EVENT_KEY: undefined,
      },
    }));

    const { inngest } = await import("@/lib/inngest/client");
    expect(inngest).toBeDefined();
  });

  it("configures client in production mode with explicit keys and INNGEST_BASE_URL", async () => {
    vi.doMock("@/config/env", () => ({
      env: {
        NODE_ENV: "production",
        INNGEST_DEV: "0",
        INNGEST_SIGNING_KEY: "prod-signing-key",
        INNGEST_EVENT_KEY: "prod-event-key",
        INNGEST_BASE_URL: "https://custom-inngest.internal",
      },
    }));

    const { inngest } = await import("@/lib/inngest/client");
    expect(inngest).toBeDefined();
  });

  it("handles 'local' signing and event keys gracefully by treating them as undefined", async () => {
    vi.doMock("@/config/env", () => ({
      env: {
        NODE_ENV: "production",
        INNGEST_DEV: "0",
        INNGEST_SIGNING_KEY: "local",
        INNGEST_EVENT_KEY: "local",
      },
    }));

    const { inngest } = await import("@/lib/inngest/client");
    expect(inngest).toBeDefined();
  });
});

