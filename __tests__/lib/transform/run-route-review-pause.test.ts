import { describe, it, expect, vi, beforeEach } from "vitest";

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

import { auth } from "@/lib/auth/auth";
import { initTransformRun } from "@/lib/transform/lifecycle-service";
import { runTransformSteps } from "@/lib/transform/run-steps";
import { POST } from "@/app/api/transform/run/route";

function makeRequest(body: unknown) {
  return new Request("http://localhost/api/transform/run", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const validBody = {
  type: "new",
  agentId: "11111111-1111-4111-8111-111111111111",
};

describe("POST /api/transform/run — review gate pause handling (T6.1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
      run: { id: "run-pause" },
      agent: {
        steps: JSON.stringify([
          { order: 0, name: "step-0", mcpServerIds: [], requiresReview: true },
        ]),
        requiresFileUpload: false,
      },
      startFromStep: 0,
    } as any);
  });

  it("does NOT mark run as completed when runTransformSteps returns paused:true", async () => {
    vi.mocked(runTransformSteps).mockResolvedValue({
      success: true,
      paused: true,
      currentOutputAttachmentIds: [],
    } as any);

    const res = await POST(makeRequest(validBody));
    const text = await res.text();

    // No transform-complete event
    expect(text).not.toContain("transform-complete");

    // status should NOT be updated to "completed"
    const completedCall = chainable.set.mock.calls.find(
      ([arg]) =>
        arg !== null && typeof arg === "object" && arg.status === "completed",
    );
    expect(completedCall).toBeUndefined();
  });

  it("emits transform-complete when run succeeds without pausing", async () => {
    vi.mocked(runTransformSteps).mockResolvedValue({
      success: true,
      paused: false,
      currentOutputAttachmentIds: [],
    } as any);

    const res = await POST(makeRequest(validBody));
    const text = await res.text();

    expect(text).toContain("transform-complete");
  });
});
