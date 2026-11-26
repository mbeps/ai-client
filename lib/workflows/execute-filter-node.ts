import type { LanguageModel } from "ai";
import { z } from "zod";
import { generateStructuredObject } from "@/lib/chat/generate-structured-object";
import {
  compileWorkflowTemplate,
  resolveWorkflowTemplateValue,
} from "@/lib/workflows/compile-template";
import { evaluateDeterministicRules } from "@/lib/workflows/evaluate-if-condition";
import type { FilterNodeData } from "@/types/workflows/workflow";

const MAX_FILTER_ITEMS = 500;
const LLM_BATCH_SIZE = 100;

const llmFilterResultSchema = z.object({
  matchingIndices: z.array(z.number().int()),
  reasoning: z.string(),
});

export interface FilterExecutionResult {
  items: unknown[];
  excluded: unknown[];
  count: number;
  totalCount: number;
  reasoning: string;
  activeHandles: string[];
}

/**
 * Executes a `filter` DAG node in deterministic or batched LLM mode.
 */
export async function executeFilterNode(params: {
  data: FilterNodeData;
  context: Record<string, unknown>;
  model?: LanguageModel;
}): Promise<FilterExecutionResult> {
  const { data, context, model } = params;

  const resolved = resolveWorkflowTemplateValue(data.itemsTemplate, context);
  if (!Array.isArray(resolved)) {
    throw new Error(
      `Filter itemsTemplate "${data.itemsTemplate}" must resolve to an array`,
    );
  }
  if (resolved.length > MAX_FILTER_ITEMS) {
    throw new Error(
      `Filter node received ${resolved.length} items, exceeding the maximum of ${MAX_FILTER_ITEMS}`,
    );
  }

  const { items, excluded, reasoning } =
    data.evaluationMode === "deterministic"
      ? filterDeterministic(resolved, data, context)
      : await filterWithLlm(resolved, data, context, model);

  const activeHandles =
    items.length === 0 && data.continueWhenEmpty === false ? [] : ["main"];

  return {
    items,
    excluded,
    count: items.length,
    totalCount: resolved.length,
    reasoning,
    activeHandles,
  };
}

function filterDeterministic(
  source: unknown[],
  data: FilterNodeData,
  context: Record<string, unknown>,
): { items: unknown[]; excluded: unknown[]; reasoning: string } {
  const items: unknown[] = [];
  const excluded: unknown[] = [];

  for (let index = 0; index < source.length; index += 1) {
    const item = source[index];
    const { matched } = evaluateDeterministicRules(data.rules, data.logic, {
      ...context,
      item,
      index,
    });
    if (matched) {
      items.push(item);
    } else {
      excluded.push(item);
    }
  }

  return {
    items,
    excluded,
    reasoning: `Deterministic filter (${data.logic.toUpperCase()}): ${items.length}/${source.length} matched`,
  };
}

async function filterWithLlm(
  source: unknown[],
  data: FilterNodeData,
  context: Record<string, unknown>,
  model?: LanguageModel,
): Promise<{ items: unknown[]; excluded: unknown[]; reasoning: string }> {
  if (!model) {
    throw new Error("No model configured for LLM filter evaluation");
  }

  const compiledCriteria = compileWorkflowTemplate(
    data.llmFilterPrompt || "",
    context,
  );
  const matchedIndices = new Set<number>();
  const reasonings: string[] = [];

  for (let offset = 0; offset < source.length; offset += LLM_BATCH_SIZE) {
    const batch = source.slice(offset, offset + LLM_BATCH_SIZE);
    const indexedBatch = batch.map((item, idx) => ({ index: idx, item }));

    const output = await generateStructuredObject({
      model,
      schema: llmFilterResultSchema,
      schemaName: "WorkflowFilterSelection",
      schemaDescription:
        "Indices of items in the provided batch that match the filter criteria",
      system:
        "You filter items against the given criteria. Return only the 0-based `matchingIndices` from the provided batch and concise `reasoning`.",
      prompt: `Criteria:\n${compiledCriteria}\n\nItems:\n${JSON.stringify(indexedBatch)}`,
    });

    for (const idx of output.matchingIndices) {
      if (Number.isInteger(idx) && idx >= 0 && idx < batch.length) {
        matchedIndices.add(offset + idx);
      }
    }
    if (output.reasoning) {
      reasonings.push(output.reasoning);
    }
  }

  const items: unknown[] = [];
  const excluded: unknown[] = [];
  for (let i = 0; i < source.length; i += 1) {
    if (matchedIndices.has(i)) {
      items.push(source[i]);
    } else {
      excluded.push(source[i]);
    }
  }

  return {
    items,
    excluded,
    reasoning:
      reasonings.length > 0
        ? reasonings.join(" | ")
        : `LLM filter: ${items.length}/${source.length} matched`,
  };
}
