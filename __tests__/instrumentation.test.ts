import { afterEach, describe, expect, it, vi } from "vitest";
import { onRequestError, register } from "@/instrumentation";

describe("Instrumentation", () => {
  const originalRuntime = process.env.NEXT_RUNTIME;

  afterEach(() => {
    process.env.NEXT_RUNTIME = originalRuntime;
    vi.restoreAllMocks();
  });

  it("register does nothing outside nodejs runtime", async () => {
    process.env.NEXT_RUNTIME = "edge";
    await expect(register()).resolves.toBeUndefined();
  });

  it("register configures logging when in nodejs runtime", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    await expect(register()).resolves.toBeUndefined();
  });

  it("onRequestError does nothing outside nodejs runtime", async () => {
    process.env.NEXT_RUNTIME = "edge";
    const request = {
      path: "/api/chat",
      method: "POST",
      headers: {},
    };
    const context = {
      routerKind: "App Router",
      routePath: "/api/chat",
      routeType: "route",
    };
    await expect(onRequestError(new Error("error"), request, context)).resolves.toBeUndefined();
  });

  it("onRequestError logs error with Error instance, stack, and digest in nodejs runtime", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    const error = new Error("Test runtime crash") as Error & { digest?: string };
    error.digest = "test-digest";
    error.stack = "Error: Test runtime crash\n    at test.ts:1:1";

    const request = {
      path: "/api/chat",
      method: "POST",
      headers: { "user-agent": "test-agent" },
    };
    const context = {
      routerKind: "App Router",
      routePath: "/api/chat",
      routeType: "route",
    };

    await expect(onRequestError(error, request, context)).resolves.toBeUndefined();
  });

  it("onRequestError logs error with Error instance without stack", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    const error = new Error("Error without stack");
    delete error.stack;

    const request = {
      path: "/api/chat",
      method: "POST",
      headers: {},
    };
    const context = {
      routerKind: "App Router",
      routePath: "/api/chat",
      routeType: "route",
    };

    await expect(onRequestError(error, request, context)).resolves.toBeUndefined();
  });

  it("onRequestError logs non-Error value and missing digest", async () => {
    process.env.NEXT_RUNTIME = "nodejs";
    const error = "plain string error";

    const request = {
      path: "/api/test",
      method: "GET",
      headers: {},
    };
    const context = {
      routerKind: "Pages Router",
      routePath: "/api/test",
      routeType: "render",
    };

    await expect(onRequestError(error, request, context)).resolves.toBeUndefined();
  });
});
