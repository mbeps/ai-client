import { afterEach, describe, expect, it, vi } from "vitest";
import { env } from "@/config/env";
import { getRealtimeApiBaseUrl } from "@/lib/inngest/realtime-url";

describe("getRealtimeApiBaseUrl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("returns undefined when window is undefined", () => {
    vi.stubGlobal("window", undefined);
    expect(getRealtimeApiBaseUrl()).toBeUndefined();
  });

  it("returns port 8288 URL in development when window is defined", () => {
    vi.spyOn(env, "NODE_ENV", "get").mockReturnValue("development");
    vi.stubGlobal("window", {
      location: {
        protocol: "http:",
        hostname: "localhost",
      },
    });

    expect(getRealtimeApiBaseUrl()).toBe("http://localhost:8288");
  });

  it("returns undefined in production even if window is defined", () => {
    vi.spyOn(env, "NODE_ENV", "get").mockReturnValue("production");
    vi.stubGlobal("window", {
      location: {
        protocol: "https:",
        hostname: "example.com",
      },
    });

    expect(getRealtimeApiBaseUrl()).toBeUndefined();
  });
});

