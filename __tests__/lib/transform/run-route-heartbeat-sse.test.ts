import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/env", () => ({
  env: {
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
    BETTER_AUTH_SECRET: "test-secret",
    BETTER_AUTH_URL: "http://localhost:3000",
    NEXT_PUBLIC_APP_URL: "http://localhost:3000",
    S3_ENDPOINT: "http://localhost:9000",
    S3_REGION: "us-east-1",
    S3_ACCESS_KEY: "test",
    S3_SECRET_KEY: "test",
    S3_BUCKET: "test-bucket",
    POSTMARK_SERVER_TOKEN: "test-token",
    POSTMARK_FROM_EMAIL: "noreply@example.com",
    NODE_ENV: "test",
  },
}));

vi.mock("next/headers", () => ({ headers: vi.fn().mockResolvedValue({}) }));

const chainable = vi.hoisted(() => {
  const c = {} as Record<string, ReturnType<typeof vi.fn>>;
  for (const m of ["select", "from", "insert", "values", "update", "set"]) {
    c[m] = vi.fn();
  }
  c.where = vi.fn().mockImplementation(() => c);
  c.limit = vi.fn().mockResolvedValue([]);
  c.returning = vi.fn().mockResolvedValue([]);
  for (const m of ["select", "from", "insert", "values", "update", "set"]) {
    c[m].mockImplementation(() => c);
  }
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));
vi.mock("@/lib/auth/auth", () => ({
  auth: { api: { getSession: vi.fn() } },
}));
vi.mock("@/lib/transform/lifecycle-service", () => ({
  initTransformRun: vi.fn(),
  resetStuckRuns: vi.fn().mockResolvedValue(0),
  validateStepOrders: vi.fn(), // no-op; valid orders in all test cases
}));
vi.mock("@/lib/transform/run-steps", () => ({
  runTransformSteps: vi.fn(),
}));
vi.mock("@/lib/transform/load-transform-context", () => ({
  loadTransformContext: vi.fn().mockResolvedValue({
    allServers: [],
    resolvedProvider: { sdkProvider: { chat: () => () => {} }, modelId: "m" },
    kbContext: "",
    mcpTools: {},
    toolSourceMap: {},
    mcpCleanup: vi.fn().mockResolvedValue(undefined),
  }),
}));

import { POST } from "@/app/api/transform/run/route";
import { auth } from "@/lib/auth/auth";
import { initTransformRun } from "@/lib/transform/lifecycle-service";
import { runTransformSteps } from "@/lib/transform/run-steps";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/transform/run", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

describe("POST /api/transform/run — SSE heartbeat (T6.4)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
    for (const m of ["select", "from", "insert", "values", "update", "set"]) {
      chainable[m].mockImplementation(() => chainable);
    }
    chainable.where.mockImplementation(() => chainable);
    chainable.limit.mockResolvedValue([]);
    chainable.returning.mockResolvedValue([]);

    vi.mocked(auth.api.getSession).mockResolvedValue({
      user: { id: "user-1" },
      session: { id: "session-1" },
    } as any);

    vi.mocked(initTransformRun).mockResolvedValue({
      run: { id: "run-hb" },
      agent: {
        steps: JSON.stringify([
          { order: 0, name: "s0", mcpServerIds: [], requiresReview: false },
        ]),
        requiresFileUpload: false,
      },
      startFromStep: 0,
    } as any);

    vi.mocked(runTransformSteps).mockResolvedValue({
      success: true,
      paused: false,
      currentOutputAttachmentIds: [],
    } as any);
  });

  it("calls setInterval with 25000ms during route execution", async () => {
    const setIntervalSpy = vi.spyOn(global, "setInterval");
    const clearIntervalSpy = vi.spyOn(global, "clearInterval");

    const res = await POST(
      makeRequest({
        type: "new",
        agentId: "11111111-1111-4111-8111-111111111111",
      }),
    );
    await res.text();

    // The heartbeat setInterval should be called with 25_000ms
    const heartbeatCall = setIntervalSpy.mock.calls.find(
      ([, ms]) => ms === 25_000,
    );
    expect(heartbeatCall).toBeDefined();

    // clearInterval should be called to clean up
    expect(clearIntervalSpy).toHaveBeenCalled();
  });

  it("still emits transform-complete on success", async () => {
    const res = await POST(
      makeRequest({
        type: "new",
        agentId: "11111111-1111-4111-8111-111111111111",
      }),
    );
    const text = await res.text();
    expect(text).toContain("transform-complete");
  });
});
