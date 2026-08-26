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
  generateText: vi.fn().mockResolvedValue({ text: "step done", steps: [] }),
  stepCountIs: vi.fn(),
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
  runRow: { id: "run-review" },
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

describe("runTransformSteps — human review gate (T6.1)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.update.mockImplementation(() => chainable);
    chainable.set.mockImplementation(() => chainable);
    chainable.where.mockImplementation(() => chainable);
  });

    const steps = [
      {
        order: 0,
        name: "review-step",
        prompt: "do thing",
        mcpServerIds: [],
        toolIds: [],
        requiresReview: true,
      },
    ];
    const emitted: any[] = [];

    await runTransformSteps({
      ...BASE_OPTIONS,
      steps,
      startFromStep: 0,
      emit: (d) => emitted.push(d),
    });

    const reviewEvent = emitted.find(
      (e) => e.type === "transform-review-required",
    );
    expect(reviewEvent).toBeDefined();
    expect(reviewEvent.runId).toBe("run-review");
    expect(reviewEvent.stepIndex).toBe(0);
  });

    const steps = [
      {
        order: 99, // order differs from array index intentionally
        name: "review-step",
        prompt: "do thing",
        mcpServerIds: [],
        toolIds: [],
        requiresReview: true,
      },
    ];

    await runTransformSteps({
      ...BASE_OPTIONS,
      steps,
      startFromStep: 0,
      emit: () => {},
    });

    const awaitingCall = chainable.set.mock.calls.find(
      ([arg]) =>
        arg !== null &&
        typeof arg === "object" &&
        arg.status === "awaiting_review",
    );
    expect(awaitingCall).toBeDefined();
    // currentStepIndex must be the array index (0), not step.order (99)
    expect(awaitingCall![0].currentStepIndex).toBe(0);
  });

  it("returns paused:true on review gate", async () => {
    const steps = [
      {
        order: 0,
        name: "review-step",
        prompt: "do thing",
        mcpServerIds: [],
        toolIds: [],
        requiresReview: true,
      },
    ];

    const result = await runTransformSteps({
      ...BASE_OPTIONS,
      steps,
      startFromStep: 0,
      emit: () => {},
    });

    expect(result).toMatchObject({ success: true, paused: true });
  });

    const steps = [
      {
        order: 0,
        name: "step-0",
        prompt: "first",
        mcpServerIds: [],
        toolIds: [],
        requiresReview: true,
      },
      {
        order: 1,
        name: "step-1",
        prompt: "second",
        mcpServerIds: [],
        toolIds: [],
        requiresReview: false,
      },
    ];
    const emitted: any[] = [];

    await runTransformSteps({
      ...BASE_OPTIONS,
      steps,
      startFromStep: 0,
      emit: (d) => emitted.push(d),
    });

    const step1StartEvents = emitted.filter(
      (e) => e.type === "transform-step-start" && e.stepName === "step-1",
    );
    expect(step1StartEvents).toHaveLength(0);
  });

    const steps = [
      {
        order: 0,
        name: "review-step",
        prompt: "do thing",
        mcpServerIds: [],
        toolIds: [],
        requiresReview: true,
      },
    ];
    const emitted: any[] = [];

    await runTransformSteps({
      ...BASE_OPTIONS,
      steps,
      startFromStep: 0,
      emit: (d) => emitted.push(d),
    });

    const completeIdx = emitted.findIndex(
      (e) => e.type === "transform-step-complete",
    );
    const reviewIdx = emitted.findIndex(
      (e) => e.type === "transform-review-required",
    );
    expect(completeIdx).toBeGreaterThanOrEqual(0);
    expect(reviewIdx).toBeGreaterThan(completeIdx);
  });
});

  });
})
