import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getRealtimeApiBaseUrl } from "@/lib/inngest/realtime-url";

describe("getRealtimeApiBaseUrl", () => {
  const originalEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
    vi.unstubAllGlobals();
  });

  it("returns undefined when window is undefined", () => {
    vi.stubGlobal("window", undefined);
    expect(getRealtimeApiBaseUrl()).toBeUndefined();
  });

  it("returns port 8288 URL in development when window is defined", () => {
    process.env.NODE_ENV = "development";
    vi.stubGlobal("window", {
      location: {
        protocol: "http:",
        hostname: "localhost",
      },
    });

    expect(getRealtimeApiBaseUrl()).toBe("http://localhost:8288");
  });

  it("returns undefined in production even if window is defined", () => {
    process.env.NODE_ENV = "production";
    vi.stubGlobal("window", {
      location: {
        protocol: "https:",
        hostname: "example.com",
      },
    });

    expect(getRealtimeApiBaseUrl()).toBeUndefined();
  });
});

