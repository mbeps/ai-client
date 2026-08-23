import { describe, it, expect, vi, beforeEach } from "vitest";

// ── env must be mocked before any module that reads it ──────────────────────
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
}));

vi.mock("@/lib/transform/run-steps", () => ({
  runTransformSteps: vi.fn(),
}));

import { auth } from "@/lib/auth/auth";
import { initTransformRun } from "@/lib/transform/lifecycle-service";
import { runTransformSteps } from "@/lib/transform/run-steps";
import { POST } from "@/app/api/transform/run/route";
import { transformRun } from "@/drizzle/schema";

function makeRequest(body: unknown): Request {
  return new Request("http://localhost/api/transform/run", {
    method: "POST",
    body: JSON.stringify(body),
  });
}

const validBody = {
  type: "new",
  agentId: "11111111-1111-4111-8111-111111111111",
};

describe("POST /api/transform/run — outer catch failure handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // re-link chainable implementations after clearAllMocks
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
  });

  it("marks the run failed in DB when execution throws unexpectedly", async () => {
    vi.mocked(initTransformRun).mockResolvedValue({
      run: { id: "run-1" },
      agent: { steps: "[]", requiresFileUpload: false },
      startFromStep: 0,
    } as any);
    // steps parsed as [] would complete immediately; force a post-init throw
    // by making the schema-driven empty-steps path irrelevant: use an agent
    // whose steps JSON is valid but make runTransformSteps throw via a
    // non-empty steps list.
    vi.mocked(initTransformRun).mockResolvedValue({
      run: { id: "run-1" },
      agent: {
        steps: JSON.stringify([{ order: 0, name: "s1", mcpServerIds: [] }]),
        requiresFileUpload: false,
      },
      startFromStep: 0,
    } as any);
    vi.mocked(runTransformSteps).mockRejectedValue(new Error("boom"));

    const res = await POST(makeRequest(validBody));
    // consume the SSE stream so the handler runs to completion
    await res.text();

    const failUpdateCall = chainable.set.mock.calls.find(
      (call) =>
        JSON.stringify(call[0]) ===
        JSON.stringify({
          status: "failed",
          errorMessage: "Transform execution failed unexpectedly",
        }),
    );
    expect(failUpdateCall).toBeDefined();
    expect(chainable.update).toHaveBeenCalledWith(transformRun);
  });

  it("does not throw when no run row exists yet (failure before init)", async () => {
    vi.mocked(initTransformRun).mockRejectedValue(new Error("early boom"));

    const res = await POST(makeRequest(validBody));
    await expect(res.text()).resolves.toContain(
      "Transform execution failed unexpectedly",
    );
  });

  it("happy path still completes the run", async () => {
    const runRow = { id: "run-1" };
    vi.mocked(initTransformRun).mockResolvedValue({
      run: runRow,
      agent: { steps: "[]", requiresFileUpload: false },
      startFromStep: 0,
    } as any);
    vi.mocked(runTransformSteps).mockResolvedValue({
      success: true,
      currentOutputAttachmentIds: [],
    } as any);

    const res = await POST(makeRequest(validBody));
    const text = await res.text();

    expect(text).toContain("transform-complete");
    expect(chainable.set).toHaveBeenCalledWith({ status: "completed" });
  });
});
