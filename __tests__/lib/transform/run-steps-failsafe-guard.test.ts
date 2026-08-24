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

vi.mock("@/lib/transform/build-file-context", () => ({
  buildFileContext: vi.fn(),
}));
vi.mock("@/lib/transform/persist-artifact", () => ({
  persistTransformArtifact: vi.fn(),
}));

// generateText returns a step with a write_cells tool result (known mutation)
// but no upload_file was called, so activeWorkbookFilePath stays null.
vi.mock("ai", () => ({
  generateText: vi.fn().mockResolvedValue({
    text: "step done",
    steps: [
      {
        toolCalls: [{ toolCallId: "tc1", toolName: "write_cells", args: {} }],
        toolResults: [
          {
            toolCallId: "tc1",
            toolName: "write_cells",
            result: { success: true },
          },
        ],
      },
    ],
  }),
  stepCountIs: vi.fn(),
}));

import { runTransformSteps } from "@/lib/transform/run-steps";

const BASE_OPTIONS = {
  runRow: { id: "run-failsafe" },
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
  runMcpTools: {}, // no download_file tool available
  runToolSourceMap: {},
  initialAttachmentRows: [],
};

const STEPS = [
  {
    order: 0,
    name: "mutating-step",
    prompt: "mutate sheet",
    mcpServerIds: [],
    toolIds: [],
    requiresReview: false,
  },
];

describe("runTransformSteps — fail-safe guard without activeWorkbookFilePath (T6.2)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    chainable.update.mockImplementation(() => chainable);
    chainable.set.mockImplementation(() => chainable);
    chainable.where.mockImplementation(() => chainable);
  });

  it("fires fail-safe even when activeWorkbookFilePath is null (no upload_file called)", async () => {
    const emitted: any[] = [];

    const result = await runTransformSteps({
      ...BASE_OPTIONS,
      steps: STEPS,
      startFromStep: 0,
      emit: (d) => emitted.push(d),
    });

    // Should fail because mutations occurred but nothing was persisted
    expect(result.success).toBe(false);

    const errorEvent = emitted.find((e) => e.type === "error");
    expect(errorEvent).toBeDefined();
    expect(errorEvent.message).toContain("mutating-step");

    const failedCall = chainable.set.mock.calls.find(
      ([arg]) =>
        arg !== null && typeof arg === "object" && arg.status === "failed",
    );
    expect(failedCall).toBeDefined();
  });
});
