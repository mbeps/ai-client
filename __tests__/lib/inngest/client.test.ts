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
    const { inngest } = await import("@/lib/inngest/client");
    expect(inngest).toBeDefined();
  });

  it("configures client with production settings and custom base url", async () => {
    mockEnv.INNGEST_DEV = "false";
    mockEnv.INNGEST_BASE_URL = "https://inn.example.com";
    mockEnv.INNGEST_SIGNING_KEY = "sign-key-123";
    mockEnv.INNGEST_EVENT_KEY = "event-key-123";
    mockEnv.NODE_ENV = "production";

    const { inngest } = await import("@/lib/inngest/client");
    expect(inngest).toBeDefined();
  });

  it("configures client with production settings and empty base url (isDev false)", async () => {
    mockEnv.INNGEST_DEV = "false";
    mockEnv.INNGEST_BASE_URL = "";
    mockEnv.INNGEST_SIGNING_KEY = "sign-key-123";
    mockEnv.INNGEST_EVENT_KEY = "";
    mockEnv.NODE_ENV = "production";

    const { inngest } = await import("@/lib/inngest/client");
    expect(inngest).toBeDefined();
  });
});
