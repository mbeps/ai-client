import { describe, it, expect, vi, beforeEach } from "vitest";

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
    CHAT_MAX_STEPS: 10,
    NODE_ENV: "test",
  },
}));

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

import { runTransformSteps } from "@/lib/transform/run-steps";
import { transformRun } from "@/drizzle/schema";

const BASE_OPTIONS = {
  runRow: { id: "run-idx" },
  agentRow: {
    id: "agent-1",
    name: "test-agent",
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
};

describe("runTransformSteps — currentStepIndex as array index (T6.3)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.update.mockImplementation(() => chainable);
    chainable.set.mockImplementation(() => chainable);
    chainable.where.mockImplementation(() => chainable);
  });

  it("stores array index (0,1) not step.order (10,20) in currentStepIndex", async () => {
    // step.order values deliberately differ from array indices
    const steps = [
      {
        order: 10,
        name: "s0",
        prompt: "p",
        mcpServerIds: [],
        toolIds: [],
        requiresReview: false,
      },
      {
        order: 20,
        name: "s1",
        prompt: "p",
        mcpServerIds: [],
        toolIds: [],
        requiresReview: false,
      },
    ];

    await runTransformSteps({
      ...BASE_OPTIONS,
      steps,
      startFromStep: 0,
      emit: () => {},
    });

    // Collect all currentStepIndex updates (not heartbeat updatedAt calls)
    const stepIndexCalls = chainable.set.mock.calls.filter(
      ([arg]) =>
        arg !== null && typeof arg === "object" && "currentStepIndex" in arg,
    );

    expect(stepIndexCalls.length).toBeGreaterThanOrEqual(2);

    // Should be array indices 0, 1 — NOT step.order values 10, 20
    expect(stepIndexCalls[0][0].currentStepIndex).toBe(0);
    expect(stepIndexCalls[1][0].currentStepIndex).toBe(1);

    expect(chainable.update).toHaveBeenCalledWith(transformRun);
  });
});
