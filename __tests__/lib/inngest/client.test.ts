import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const mockEnv = vi.hoisted(() => ({
  INNGEST_DEV: "1",
  INNGEST_BASE_URL: "",
  INNGEST_SIGNING_KEY: "local",
  INNGEST_EVENT_KEY: "local",
  NODE_ENV: "development",
}));

vi.mock("@/config/env", () => ({
  env: mockEnv,
}));

describe("Inngest Client Configuration", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("configures client correctly with dev defaults", async () => {
    mockEnv.INNGEST_DEV = "1";
    mockEnv.INNGEST_SIGNING_KEY = "local";
    mockEnv.INNGEST_EVENT_KEY = "local";
    mockEnv.NODE_ENV = "development";
    mockEnv.INNGEST_BASE_URL = "";

    const { inngest } = await import("@/lib/inngest/client");
    expect(inngest).toBeDefined();
    expect(inngest.id).toBe("ai-client");
  });

  it("configures client in development mode with INNGEST_DEV='true'", async () => {
    mockEnv.INNGEST_DEV = "true";
    mockEnv.INNGEST_SIGNING_KEY = "sign-key";
    mockEnv.INNGEST_EVENT_KEY = "event-key";
    mockEnv.NODE_ENV = "production";

    const { inngest } = await import("@/lib/inngest/client");
    expect(inngest).toBeDefined();
    expect((inngest as any).options.isDev).toBe(true);
  });

  it("configures client in development mode when NODE_ENV is not production", async () => {
    mockEnv.INNGEST_DEV = "0";
    mockEnv.INNGEST_SIGNING_KEY = "sign-key";
    mockEnv.INNGEST_EVENT_KEY = "event-key";
    mockEnv.NODE_ENV = "test";

    const { inngest } = await import("@/lib/inngest/client");
    expect(inngest).toBeDefined();
    expect((inngest as any).options.isDev).toBe(true);
  });

  it("configures client in development mode when INNGEST_SIGNING_KEY is missing", async () => {
    mockEnv.INNGEST_DEV = "0";
    mockEnv.INNGEST_SIGNING_KEY = "";
    mockEnv.INNGEST_EVENT_KEY = "";
    mockEnv.NODE_ENV = "production";

    const { inngest } = await import("@/lib/inngest/client");
    expect(inngest).toBeDefined();
    expect((inngest as any).options.isDev).toBe(true);
  });

  it("configures client with production settings and custom base url", async () => {
    mockEnv.INNGEST_DEV = "false";
    mockEnv.INNGEST_BASE_URL = "https://inn.example.com";
    mockEnv.INNGEST_SIGNING_KEY = "sign-key-123";
    mockEnv.INNGEST_EVENT_KEY = "event-key-123";
    mockEnv.NODE_ENV = "production";

    const { inngest } = await import("@/lib/inngest/client");
    expect(inngest).toBeDefined();
    expect((inngest as any).options.isDev).toBe(false);
  });

  it("configures client with production settings and empty base url (isDev false)", async () => {
    mockEnv.INNGEST_DEV = "false";
    mockEnv.INNGEST_BASE_URL = "";
    mockEnv.INNGEST_SIGNING_KEY = "sign-key-123";
    mockEnv.INNGEST_EVENT_KEY = "";
    mockEnv.NODE_ENV = "production";

    const { inngest } = await import("@/lib/inngest/client");
    expect(inngest).toBeDefined();
    expect((inngest as any).options.isDev).toBe(false);
  });

  it("handles 'local' signing and event keys gracefully by treating them as undefined in production", async () => {
    mockEnv.INNGEST_DEV = "false";
    mockEnv.INNGEST_BASE_URL = "";
    mockEnv.INNGEST_SIGNING_KEY = "local";
    mockEnv.INNGEST_EVENT_KEY = "local";
    mockEnv.NODE_ENV = "production";

    const { inngest } = await import("@/lib/inngest/client");
    expect(inngest).toBeDefined();
    expect((inngest as any).options.isDev).toBe(true);
  });
});
