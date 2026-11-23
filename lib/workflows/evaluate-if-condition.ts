import type { LanguageModel } from "ai";
import { z } from "zod";
import { generateStructuredObject } from "@/lib/chat/generate-structured-object";
import { compileWorkflowTemplate } from "@/lib/workflows/compile-template";
import type {
  IfConditionNodeData,
  IfConditionRule,
} from "@/types/workflows/workflow";

const llmConditionResultSchema = z.object({
  result: z.boolean(),
  reasoning: z.string(),
});

function evaluateSingleRule(
  rule: IfConditionRule,
  context: Record<string, unknown>,
): boolean {
  const left = compileWorkflowTemplate(rule.leftTemplate, context);
  const right = rule.rightValue ?? "";

  switch (rule.operator) {
    case "equals":
      return left === right;
    case "not_equals":
      return left !== right;
    case "contains":
      return left.includes(right);
    case "not_contains":
      return !left.includes(right);
    case "starts_with":
      return left.startsWith(right);
    case "ends_with":
      return left.endsWith(right);
    case "regex": {
      try {
        return new RegExp(right).test(left);
      } catch {
        return false;
      }
    }
    case "gt": {
      const lNum = Number(left);
      const rNum = Number(right);
      return Number.isFinite(lNum) && Number.isFinite(rNum) && lNum > rNum;
    }
    case "lt": {
      const lNum = Number(left);
      const rNum = Number(right);
      return Number.isFinite(lNum) && Number.isFinite(rNum) && lNum < rNum;
    }
    case "is_empty":
      return left.trim().length === 0;
    case "is_not_empty":
      return left.trim().length > 0;
  }
}

/**
 * Evaluates deterministic rule conditions using AND or OR combination semantics.
 */
export function evaluateDeterministicRules(
  rules: IfConditionRule[],
  logic: "and" | "or",
  context: Record<string, unknown>,
): { matched: boolean; summary: string } {
  if (rules.length === 0) {
    return {
      matched: false,
      summary: "No deterministic rules configured (0/0)",
    };
  }

  let passedCount = 0;
  for (const rule of rules) {
    if (evaluateSingleRule(rule, context)) {
      passedCount += 1;
    }
  }

  const matched =
    logic === "and" ? passedCount === rules.length : passedCount > 0;
  return {
    matched,
    summary: `Deterministic rules (${logic.toUpperCase()}): ${passedCount}/${rules.length} matched`,
  };
}

/**
 * Evaluates an `if_condition` DAG node in deterministic, LLM, or hybrid mode.
 */
export async function evaluateIfConditionNode(params: {
  data: IfConditionNodeData;
  context: Record<string, unknown>;
  model?: LanguageModel;
}): Promise<{ branch: "true" | "false"; reasoning: string }> {
  const { data, context, model } = params;

  if (data.evaluationMode === "deterministic") {
    const det = evaluateDeterministicRules(data.rules, data.logic, context);
    return {
      branch: det.matched ? "true" : "false",
      reasoning: det.summary,
    };
  }

  let detSummary = "";
  if (data.evaluationMode === "hybrid") {
    const det = evaluateDeterministicRules(data.rules, data.logic, context);
    detSummary = det.summary;
    if (data.logic === "and" && !det.matched) {
      return {
        branch: "false",
        reasoning: `${det.summary} (short-circuited AND)`,
      };
    }
    if (data.logic === "or" && det.matched) {
      return {
        branch: "true",
        reasoning: `${det.summary} (short-circuited OR)`,
      };
    }
  }

  if (!model) {
    throw new Error("No model configured for LLM condition evaluation");
  }

  const compiledPrompt = compileWorkflowTemplate(
    data.llmConditionPrompt || "",
    context,
  );

  const output = await generateStructuredObject({
    model,
    schema: llmConditionResultSchema,
    schemaName: "WorkflowConditionDecision",
    schemaDescription: "Boolean branch evaluation for workflow condition node",
    system:
      "You evaluate a workflow condition and return whether it is true or false with concise reasoning.",
    prompt: compiledPrompt,
  });

  const reasoning = detSummary
    ? `${detSummary}; LLM: ${output.reasoning}`
    : output.reasoning;

  return {
    branch: output.result ? "true" : "false",
    reasoning,
  };
}
