import { describe, expect, it } from "vitest";
import { workflowNodeSchema } from "@/schemas/workflows/workflow";

describe("flow control workflowNodeSchema (filter & loop)", () => {
  it("accepts a valid filter node", () => {
    const result = workflowNodeSchema.safeParse({
      id: "filter-1",
      type: "filter",
      name: "Filter Items",
      position: { x: 0, y: 0 },
      data: {
        kind: "filter",
        variableName: "filteredItems",
        itemsTemplate: "{{step1.items}}",
        evaluationMode: "deterministic",
        logic: "and",
        rules: [
          {
            id: "r1",
            leftTemplate: "{{item.score}}",
            operator: "equals",
            rightValue: "10",
          },
        ],
        continueWhenEmpty: true,
      },
    });

    expect(result.success).toBe(true);
  });

  it("accepts a valid loop node with default maxIterations", () => {
    const result = workflowNodeSchema.safeParse({
      id: "loop-1",
      type: "loop",
      name: "Loop Items",
      position: { x: 0, y: 0 },
      data: {
        kind: "loop",
        variableName: "loop1",
        mode: "for_each",
        itemsTemplate: "{{step1.items}}",
      },
    });

    expect(result.success).toBe(true);
    if (result.success && result.data.data.kind === "loop") {
      expect(result.data.data.maxIterations).toBe(20);
    }
  });

  it("rejects loop maxIterations > 50 or < 1", () => {
    const tooHigh = workflowNodeSchema.safeParse({
      id: "loop-1",
      type: "loop",
      name: "Loop",
      position: { x: 0, y: 0 },
      data: {
        kind: "loop",
        variableName: "loop1",
        mode: "count",
        count: 5,
        maxIterations: 51,
      },
    });
    expect(tooHigh.success).toBe(false);

    const tooLow = workflowNodeSchema.safeParse({
      id: "loop-2",
      type: "loop",
      name: "Loop",
      position: { x: 0, y: 0 },
      data: {
        kind: "loop",
        variableName: "loop2",
        mode: "count",
        count: 5,
        maxIterations: 0,
      },
    });
    expect(tooLow.success).toBe(false);
  });

  it("rejects loop count > 50 or < 1", () => {
    const tooHigh = workflowNodeSchema.safeParse({
      id: "loop-1",
      type: "loop",
      name: "Loop",
      position: { x: 0, y: 0 },
      data: {
        kind: "loop",
        variableName: "loop1",
        mode: "count",
        count: 51,
        maxIterations: 20,
      },
    });
    expect(tooHigh.success).toBe(false);
  });
});
