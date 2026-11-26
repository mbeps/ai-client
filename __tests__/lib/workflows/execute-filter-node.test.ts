import { describe, expect, it, vi, beforeEach } from "vitest";
import type { LanguageModel } from "ai";
import type { FilterNodeData } from "@/types/workflows/workflow";

vi.mock("@/lib/chat/generate-structured-object", () => ({
  generateStructuredObject: vi.fn(),
}));

import { generateStructuredObject } from "@/lib/chat/generate-structured-object";
import { executeFilterNode } from "@/lib/workflows/execute-filter-node";

const mockModel = { modelId: "test-model" } as unknown as LanguageModel;

function makeBaseData(overrides: Partial<FilterNodeData> = {}): FilterNodeData {
  return {
    kind: "filter",
    variableName: "filtered",
    itemsTemplate: "{{step1.items}}",
    evaluationMode: "deterministic",
    logic: "and",
    rules: [],
    continueWhenEmpty: true,
    ...overrides,
  };
}

describe("executeFilterNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws a descriptive error when itemsTemplate does not resolve to an array", async () => {
    await expect(
      executeFilterNode({
        data: makeBaseData(),
        context: { step1: { items: "not-an-array" } },
      }),
    ).rejects.toThrow(/must resolve to an array/i);
  });

  it("throws a descriptive error when array exceeds 500 items", async () => {
    const items = Array.from({ length: 501 }, (_, i) => i);
    await expect(
      executeFilterNode({
        data: makeBaseData(),
        context: { step1: { items } },
      }),
    ).rejects.toThrow(/500/);
  });

  it("filters array of objects with deterministic AND rules using {{item.field}}", async () => {
    const items = [
      { name: "Alice", status: "active", score: 90 },
      { name: "Bob", status: "inactive", score: 95 },
      { name: "Charlie", status: "active", score: 40 },
    ];

    const result = await executeFilterNode({
      data: makeBaseData({
        logic: "and",
        rules: [
          { id: "r1", leftTemplate: "{{item.status}}", operator: "equals", rightValue: "active" },
          { id: "r2", leftTemplate: "{{item.score}}", operator: "gt", rightValue: "50" },
        ],
      }),
      context: { step1: { items } },
    });

    expect(result.items).toEqual([{ name: "Alice", status: "active", score: 90 }]);
    expect(result.excluded).toEqual([
      { name: "Bob", status: "inactive", score: 95 },
      { name: "Charlie", status: "active", score: 40 },
    ]);
    expect(result.count).toBe(1);
    expect(result.totalCount).toBe(3);
    expect(result.activeHandles).toEqual(["main"]);
  });

  it("filters array of primitives with deterministic OR rules using {{item}}", async () => {
    const items = ["apple", "banana", "apricot", "cherry"];

    const result = await executeFilterNode({
      data: makeBaseData({
        logic: "or",
        rules: [
          { id: "r1", leftTemplate: "{{item}}", operator: "starts_with", rightValue: "ap" },
          { id: "r2", leftTemplate: "{{item}}", operator: "equals", rightValue: "cherry" },
        ],
      }),
      context: { step1: { items } },
    });

    expect(result.items).toEqual(["apple", "apricot", "cherry"]);
    expect(result.excluded).toEqual(["banana"]);
    expect(result.count).toBe(3);
    expect(result.totalCount).toBe(4);
    expect(result.activeHandles).toEqual(["main"]);
  });

  it("returns activeHandles: [] when 0 items match and continueWhenEmpty is false", async () => {
    const result = await executeFilterNode({
      data: makeBaseData({
        continueWhenEmpty: false,
        rules: [{ id: "r1", leftTemplate: "{{item}}", operator: "equals", rightValue: "missing" }],
      }),
      context: { step1: { items: ["a", "b"] } },
    });

    expect(result.items).toEqual([]);
    expect(result.count).toBe(0);
    expect(result.activeHandles).toEqual([]);
  });

  it("returns activeHandles: ['main'] when 0 items match and continueWhenEmpty is true", async () => {
    const result = await executeFilterNode({
      data: makeBaseData({
        continueWhenEmpty: true,
        rules: [{ id: "r1", leftTemplate: "{{item}}", operator: "equals", rightValue: "missing" }],
      }),
      context: { step1: { items: ["a", "b"] } },
    });

    expect(result.items).toEqual([]);
    expect(result.activeHandles).toEqual(["main"]);
  });

  it("throws when evaluationMode is llm and no model is provided", async () => {
    await expect(
      executeFilterNode({
        data: makeBaseData({
          evaluationMode: "llm",
          llmFilterPrompt: "Keep urgent items",
        }),
        context: { step1: { items: ["a"] } },
      }),
    ).rejects.toThrow(/no model configured/i);
  });

  it("batches LLM filtering in chunks of 100 and ignores out-of-range indices", async () => {
    const items = Array.from({ length: 105 }, (_, i) => ({ id: i }));

    vi.mocked(generateStructuredObject)
      .mockResolvedValueOnce({
        matchingIndices: [0, 99, 150, -1, 0],
        reasoning: "Batch 1",
      })
      .mockResolvedValueOnce({
        matchingIndices: [2, 10],
        reasoning: "Batch 2",
      });

    const result = await executeFilterNode({
      data: makeBaseData({
        evaluationMode: "llm",
        llmFilterPrompt: "Keep selected items",
      }),
      context: { step1: { items } },
      model: mockModel,
    });

    expect(generateStructuredObject).toHaveBeenCalledTimes(2);
    expect(result.items).toEqual([{ id: 0 }, { id: 99 }, { id: 102 }]);
    expect(result.count).toBe(3);
    expect(result.totalCount).toBe(105);
    expect(result.excluded).toHaveLength(102);
    expect(result.reasoning).toContain("Batch 1");
    expect(result.reasoning).toContain("Batch 2");
    expect(result.activeHandles).toEqual(["main"]);
  });
});
