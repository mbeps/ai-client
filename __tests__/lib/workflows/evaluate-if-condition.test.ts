import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  evaluateDeterministicRules,
  evaluateIfConditionNode,
} from "@/lib/workflows/evaluate-if-condition";
import type { IfConditionRule } from "@/types/workflows/workflow";

const mockGenerateStructuredObject = vi.fn();

vi.mock("@/lib/chat/generate-structured-object", () => ({
  generateStructuredObject: (...args: unknown[]) =>
    mockGenerateStructuredObject(...args),
}));

describe("evaluateDeterministicRules", () => {
  it("evaluates all 11 deterministic operators accurately", () => {
    const ctx = {
      status: "approved_urgent",
      score: "95",
      emptyVal: "",
      missing: null,
    };

    const rules: IfConditionRule[] = [
      { id: "1", leftTemplate: "{{status}}", operator: "equals", rightValue: "approved_urgent" },
      { id: "2", leftTemplate: "{{status}}", operator: "not_equals", rightValue: "rejected" },
      { id: "3", leftTemplate: "{{status}}", operator: "contains", rightValue: "urgent" },
      { id: "4", leftTemplate: "{{status}}", operator: "not_contains", rightValue: "spam" },
      { id: "5", leftTemplate: "{{status}}", operator: "starts_with", rightValue: "approved" },
      { id: "6", leftTemplate: "{{status}}", operator: "ends_with", rightValue: "urgent" },
      { id: "7", leftTemplate: "{{status}}", operator: "regex", rightValue: "^approved_.*$" },
      { id: "8", leftTemplate: "{{score}}", operator: "gt", rightValue: "90" },
      { id: "9", leftTemplate: "{{score}}", operator: "lt", rightValue: "100" },
      { id: "10", leftTemplate: "{{emptyVal}}", operator: "is_empty" },
      { id: "11", leftTemplate: "{{status}}", operator: "is_not_empty" },
    ];

    const res = evaluateDeterministicRules(rules, "and", ctx);
    expect(res.matched).toBe(true);
    expect(res.summary).toContain("11/11");
  });

  it("handles invalid regex, NaN numeric comparisons, empty rules, and OR logic", () => {
    expect(evaluateDeterministicRules([], "and", {}).matched).toBe(false);

    const invalidRegex = evaluateDeterministicRules(
      [{ id: "r1", leftTemplate: "abc", operator: "regex", rightValue: "[unclosed" }],
      "and",
      {},
    );
    expect(invalidRegex.matched).toBe(false);

    const nanGt = evaluateDeterministicRules(
      [{ id: "r2", leftTemplate: "abc", operator: "gt", rightValue: "10" }],
      "and",
      {},
    );
    expect(nanGt.matched).toBe(false);

    const nanLt = evaluateDeterministicRules(
      [{ id: "r3", leftTemplate: "10", operator: "lt", rightValue: "xyz" }],
      "and",
      {},
    );
    expect(nanLt.matched).toBe(false);

    const orResult = evaluateDeterministicRules(
      [
        { id: "r4", leftTemplate: "no", operator: "equals", rightValue: "yes" },
        { id: "r5", leftTemplate: "yes", operator: "equals", rightValue: "yes" },
      ],
      "or",
      {},
    );
    expect(orResult.matched).toBe(true);
  });
});

describe("evaluateIfConditionNode", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("evaluates deterministic mode without calling LLM", async () => {
    const res = await evaluateIfConditionNode({
      data: {
        kind: "if_condition",
        variableName: "branch1",
        evaluationMode: "deterministic",
        logic: "and",
        rules: [
          { id: "r1", leftTemplate: "{{flag}}", operator: "equals", rightValue: "true" },
        ],
      },
      context: { flag: "true" },
    });
    expect(res.branch).toBe("true");
    expect(mockGenerateStructuredObject).not.toHaveBeenCalled();

    const falseRes = await evaluateIfConditionNode({
      data: {
        kind: "if_condition",
        variableName: "branch1",
        evaluationMode: "deterministic",
        logic: "and",
        rules: [
          { id: "r1", leftTemplate: "{{flag}}", operator: "equals", rightValue: "true" },
        ],
      },
      context: { flag: "false" },
    });
    expect(falseRes.branch).toBe("false");
  });

  it("evaluates llm mode via generateStructuredObject", async () => {
    mockGenerateStructuredObject.mockResolvedValue({
      result: false,
      reasoning: "Sentiment is negative",
    });

    const mockModel = { modelId: "gpt-4o" } as any;
    const res = await evaluateIfConditionNode({
      data: {
        kind: "if_condition",
        variableName: "branch1",
        evaluationMode: "llm",
        logic: "and",
        rules: [],
        llmConditionPrompt: undefined,
      },
      context: { text: "terrible experience" },
      model: mockModel,
    });

    expect(res.branch).toBe("false");
    expect(res.reasoning).toBe("Sentiment is negative");
    expect(mockGenerateStructuredObject).toHaveBeenCalledTimes(1);
  });

  it("throws when llm mode has no model configured", async () => {
    await expect(
      evaluateIfConditionNode({
        data: {
          kind: "if_condition",
          variableName: "branch1",
          evaluationMode: "llm",
          logic: "and",
          rules: [],
          llmConditionPrompt: "Check?",
        },
        context: {},
      }),
    ).rejects.toThrow("No model configured");
  });

  it("evaluates hybrid mode combining deterministic rules and LLM", async () => {
    mockGenerateStructuredObject.mockResolvedValue({
      result: true,
      reasoning: "LLM agrees",
    });
    const mockModel = { modelId: "gpt-4o" } as any;

    // AND mode short-circuits to false when deterministic fails
    const shortCircuit = await evaluateIfConditionNode({
      data: {
        kind: "if_condition",
        variableName: "branch1",
        evaluationMode: "hybrid",
        logic: "and",
        rules: [
          { id: "r1", leftTemplate: "{{ok}}", operator: "equals", rightValue: "yes" },
        ],
        llmConditionPrompt: "Also check?",
      },
      context: { ok: "no" },
      model: mockModel,
    });
    expect(shortCircuit.branch).toBe("false");
    expect(mockGenerateStructuredObject).not.toHaveBeenCalled();

    // OR mode short-circuits to true when deterministic succeeds
    const orShort = await evaluateIfConditionNode({
      data: {
        kind: "if_condition",
        variableName: "branch1",
        evaluationMode: "hybrid",
        logic: "or",
        rules: [
          { id: "r1", leftTemplate: "{{ok}}", operator: "equals", rightValue: "yes" },
        ],
        llmConditionPrompt: "Also check?",
      },
      context: { ok: "yes" },
      model: mockModel,
    });
    expect(orShort.branch).toBe("true");
    expect(mockGenerateStructuredObject).not.toHaveBeenCalled();

    // AND mode calls LLM when deterministic succeeds
    const hybridAnd = await evaluateIfConditionNode({
      data: {
        kind: "if_condition",
        variableName: "branch1",
        evaluationMode: "hybrid",
        logic: "and",
        rules: [
          { id: "r1", leftTemplate: "{{ok}}", operator: "equals", rightValue: "yes" },
        ],
        llmConditionPrompt: "Also check {{ok}}?",
      },
      context: { ok: "yes" },
      model: mockModel,
    });
    expect(hybridAnd.branch).toBe("true");
    expect(mockGenerateStructuredObject).toHaveBeenCalledTimes(1);
  });
});
