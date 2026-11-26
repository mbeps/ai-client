import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSelect } = vi.hoisted(() => ({
  mockSelect: vi.fn(),
}));

vi.mock("@/drizzle/db", () => ({
  db: {
    select: (...args: unknown[]) => mockSelect(...args),
  },
}));

import { buildWorkflowBuilderSystemPrompt } from "@/lib/workflows/build-workflow-builder-prompt";

function makeChain(result: unknown) {
  const chain: Record<string, unknown> = {};
  chain.from = vi.fn(() => chain);
  chain.where = vi.fn(() => chain);
  chain.limit = vi.fn(() => Promise.resolve(result));
  chain.then = (resolve: (v: unknown) => void) =>
    Promise.resolve(result).then(resolve);
  return chain;
}

describe("buildWorkflowBuilderSystemPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("includes live workflow JSON and all 7 node types when workflow exists", async () => {
    mockSelect
      .mockReturnValueOnce(
        makeChain([
          { id: "wf-1", name: "Invoice Flow", description: "Processes PDFs" },
        ]),
      )
      .mockReturnValueOnce(
        makeChain([
          {
            id: "n1",
            type: "manual_trigger",
            position: { x: 0, y: 0 },
            data: { kind: "manual_trigger", variableName: "trigger" },
          },
        ]),
      )
      .mockReturnValueOnce(makeChain([]));

    const prompt = await buildWorkflowBuilderSystemPrompt("user-1", "wf-1", {
      compactionSummary: "User asked to add a filter.",
    });

    expect(prompt).toContain("Invoice Flow");
    expect(prompt).toContain('"id":"wf-1"');
    expect(prompt).toContain("manual_trigger");
    expect(prompt).toContain("requiresFileUpload");
    expect(prompt).toContain("webhook_trigger");
    expect(prompt).toContain("secretHeaderName");
    expect(prompt).toContain("ai_step");
    expect(prompt).toContain("mcpServerIds");
    expect(prompt).toContain("requiresReview");
    expect(prompt).toContain("if_condition");
    expect(prompt).toContain('"hybrid"');
    expect(prompt).toContain("loop");
    expect(prompt).toContain("filter");
    expect(prompt).toContain("http_request");
    expect(prompt).toContain("User asked to add a filter.");
  });

  it("returns fallback prompt when workflow is not found", async () => {
    mockSelect.mockReturnValueOnce(makeChain([]));

    const prompt = await buildWorkflowBuilderSystemPrompt("user-1", "missing");

    expect(prompt).toContain("missing");
    expect(prompt).toContain("could not be loaded");
  });

  it("builds prompt without compactionSummary when options are omitted", async () => {
    mockSelect
      .mockReturnValueOnce(
        makeChain([
          {
            id: "wf-1",
            name: "Invoice Flow",
            description: null,
          },
        ]),
      )
      .mockReturnValueOnce(makeChain([]))
      .mockReturnValueOnce(makeChain([]));
    const prompt = await buildWorkflowBuilderSystemPrompt("user-1", "wf-1");
    expect(prompt).toContain("Invoice Flow");
    expect(prompt).not.toContain("Earlier conversation summary:");
  });
});
