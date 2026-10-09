import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockEnv = vi.hoisted(() => ({
  INNGEST_SERVE_ORIGIN: undefined as string | undefined,
}));

const serveSpy = vi.hoisted(() => vi.fn());

vi.mock("@/config/env", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/config/env")>();
  return {
    ...actual,
    env: {
      ...actual.env,
      get INNGEST_SERVE_ORIGIN() {
        return mockEnv.INNGEST_SERVE_ORIGIN;
      },
    },
  };
});

vi.mock("inngest/next", async (importOriginal) => {
  const actual = await importOriginal<typeof import("inngest/next")>();
  return {
    ...actual,
    serve: vi.fn((options: Parameters<typeof actual.serve>[0]) => {
      serveSpy(options);
      return actual.serve(options);
    }),
  };
});

describe("/api/inngest route handler", () => {
  beforeEach(() => {
    vi.resetModules();
    serveSpy.mockClear();
    mockEnv.INNGEST_SERVE_ORIGIN = undefined;
  });

  afterEach(() => {
    mockEnv.INNGEST_SERVE_ORIGIN = undefined;
  });

  it("exports GET, POST, and PUT handlers from serve() with undefined serveOrigin by default", async () => {
    mockEnv.INNGEST_SERVE_ORIGIN = undefined;
    const { GET, POST, PUT } = await import("@/app/api/inngest/route");

    expect(serveSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        serveOrigin: undefined,
      }),
    );
    expect(typeof GET).toBe("function");
    expect(typeof POST).toBe("function");
    expect(typeof PUT).toBe("function");
  });

  it("sets serveOrigin to configured origin when INNGEST_SERVE_ORIGIN is set", async () => {
    mockEnv.INNGEST_SERVE_ORIGIN = "https://custom.inngest.internal";
    await import("@/app/api/inngest/route");

    expect(serveSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        serveOrigin: "https://custom.inngest.internal",
      }),
    );
  });

  it("falls back to undefined serveOrigin when INNGEST_SERVE_ORIGIN is empty string", async () => {
    mockEnv.INNGEST_SERVE_ORIGIN = "";
    await import("@/app/api/inngest/route");

    expect(serveSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        serveOrigin: undefined,
      }),
    );
  });

  it("GET handler responds to introspection/health requests", async () => {
    const { GET } = await import("@/app/api/inngest/route");
    const req = new Request("http://localhost:3000/api/inngest");
    const res = await GET(req);
    expect(res).toBeDefined();
    expect([200, 400, 401]).toContain(res.status);
  });
});
