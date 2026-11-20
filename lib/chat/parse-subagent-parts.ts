import {
  extractSubagentOutputText,
  stripSubagentReasoning,
} from "@/lib/chat/extract-subagent-output";
import type { ToolCallState } from "@/types/tool/tool-call";

/**
 * Execution metadata attached to a subagent UIMessage result.
 */
export interface SubagentExecutionMetadata {
  modelId?: string;
  durationMs?: number;
  stepCount?: number;
  maxSteps?: number;
  finishReason?: string;
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

/**
 * Normalized subagent execution state for UI rendering.
 */
export interface ParsedSubagentResult {
  reasoningText: string;
  isStreamingReasoning: boolean;
  toolSteps: ToolCallState[];
  textContent: string;
  isStreamingText: boolean;
  hasScratchpadWrite: boolean;
  metadata?: SubagentExecutionMetadata;
}

function resolveToolPartName(part: Record<string, unknown>): string | null {
  if (part.type === "dynamic-tool" && typeof part.toolName === "string") {
    return part.toolName;
  }
  if (
    typeof part.type === "string" &&
    part.type.startsWith("tool-") &&
    part.type !== "tool-call"
  ) {
    return part.type.slice(5);
  }
  return null;
}

function mapToolPartToState(
  part: Record<string, unknown>,
  toolName: string,
  index: number,
): ToolCallState {
  const state = part.state;
  const isDone = state === "output-available" || state === "output-error";
  const result =
    state === "output-error"
      ? {
          error:
            typeof part.errorText === "string"
              ? part.errorText
              : "Tool execution failed",
        }
      : state === "output-available"
        ? part.output
        : undefined;

  return {
    toolCallId:
      typeof part.toolCallId === "string"
        ? part.toolCallId
        : `sub-tool-${index}`,
    toolName,
    args: part.input ?? part.args ?? {},
    result,
    status: isDone ? "complete" : "calling",
  };
}

/**
 * Parses a subagent execution result (streaming UIMessage or legacy string)
 * into reasoning, tool calls, streamed text, scratchpad activity, and metadata.
 *
 * @param result - Raw result from `delegate_task`
 * @returns Normalized subagent execution parts
 * @author Maruf Bepary
 */
export function parseSubagentResult(result: unknown): ParsedSubagentResult {
  if (!result || typeof result !== "object") {
    return {
      reasoningText: "",
      isStreamingReasoning: false,
      toolSteps: [],
      textContent:
        typeof result === "string" ? stripSubagentReasoning(result) : "",
      isStreamingText: false,
      hasScratchpadWrite: false,
    };
  }

  const record = result as Record<string, unknown>;
  const metadata =
    record.metadata && typeof record.metadata === "object"
      ? (record.metadata as SubagentExecutionMetadata)
      : undefined;

  if (!Array.isArray(record.parts)) {
    return {
      reasoningText: "",
      isStreamingReasoning: false,
      toolSteps: [],
      textContent: extractSubagentOutputText(result),
      isStreamingText: false,
      hasScratchpadWrite: false,
      ...(metadata ? { metadata } : {}),
    };
  }

  const reasoningChunks: string[] = [];
  const textChunks: string[] = [];
  const toolSteps: ToolCallState[] = [];
  let isStreamingReasoning = false;
  let isStreamingText = false;
  let hasScratchpadWrite = false;

  for (let i = 0; i < record.parts.length; i++) {
    const rawPart = record.parts[i];
    if (!rawPart || typeof rawPart !== "object") continue;
    const part = rawPart as Record<string, unknown>;

    if (part.type === "reasoning" && typeof part.text === "string") {
      reasoningChunks.push(part.text);
      if (part.state === "streaming") isStreamingReasoning = true;
      continue;
    }

    if (part.type === "text" && typeof part.text === "string") {
      const cleaned = stripSubagentReasoning(part.text);
      if (cleaned) textChunks.push(cleaned);
      if (part.state === "streaming") isStreamingText = true;
      continue;
    }

    const toolName = resolveToolPartName(part);
    if (toolName) {
      const toolStep = mapToolPartToState(part, toolName, i);
      toolSteps.push(toolStep);
      if (
        toolName === "scratchpad_write" &&
        toolStep.status === "complete" &&
        (toolStep.result as { success?: boolean } | undefined)?.success !==
          false
      ) {
        hasScratchpadWrite = true;
      }
    }
  }

  return {
    reasoningText: reasoningChunks.join("\n\n").trim(),
    isStreamingReasoning,
    toolSteps,
    textContent: textChunks.join("\n\n").trim(),
    isStreamingText,
    hasScratchpadWrite,
    ...(metadata ? { metadata } : {}),
  };
}
