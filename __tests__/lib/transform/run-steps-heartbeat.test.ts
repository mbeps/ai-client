import { beforeEach, describe, expect, it, vi } from "vitest";

const chainable = vi.hoisted(() => {
  const c = {} as Record<string, ReturnType<typeof vi.fn>>;
  for (const m of ["update", "set"]) c[m] = vi.fn();
  c.where = vi.fn().mockImplementation(() => c);
  c.update.mockImplementation(() => c);
  c.set.mockImplementation(() => c);
  return c;
});

vi.mock("@/drizzle/db", () => ({ db: chainable }));

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

// Heavy deps not exercised by this test — stub the AI SDK and helpers
vi.mock("ai", () => ({
  generateText: vi.fn().mockResolvedValue({ text: "ok", steps: [] }),
  isStepCount: vi.fn(),
}));
vi.mock("@/lib/transform/build-file-context", () => ({
  buildFileContext: vi.fn(),
}));
vi.mock("@/lib/transform/persist-artifact", () => ({
  persistTransformArtifact: vi.fn(),
}));

import { transformRun } from "@/drizzle/schema";
import { runTransformSteps } from "@/lib/transform/run-steps";

describe("runTransformSteps heartbeat", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.update.mockImplementation(() => chainable);
    chainable.set.mockImplementation(() => chainable);
    chainable.where.mockImplementation(() => chainable);
  });

  it("touches updatedAt once per step", async () => {
    const steps = [
      { order: 0, name: "s0", mcpServerIds: [] },
      { order: 1, name: "s1", mcpServerIds: [] },
    ];

    await runTransformSteps({
      steps,
      startFromStep: 0,
      runRow: { id: "run-hb" },
      agentRow: {
        id: "agent-1",
        name: "a",
        description: null,
        globalContext: null,
        requiresFileUpload: false,
        tools: null,
        modelId: null,
      },
      userId: "user-1",
      allServers: [],
      resolvedProvider: {
        sdkProvider: { chat: () => () => {} },
        modelId: "test-model",
      } as any,
      kbContext: "",
      runMcpTools: {},
      runToolSourceMap: {},
      initialAttachmentRows: [],
      emit: () => {},
    });

    const heartbeatCalls = chainable.set.mock.calls.filter(
      ([arg]) =>
        arg !== null &&
        typeof arg === "object" &&
        "updatedAt" in arg &&
        arg.updatedAt instanceof Date,
    );
    expect(heartbeatCalls).toHaveLength(steps.length);
    expect(chainable.update).toHaveBeenCalledWith(transformRun);
  });
});
