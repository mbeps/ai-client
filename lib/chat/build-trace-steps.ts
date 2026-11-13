import { resolveBuiltInAgentByRoleOrId } from "@/config/built-in-agents";
import type { ToolCall } from "@/types/chat/tool-call";
import type { ToolResult } from "@/types/chat/tool-result";
import type { ToolCallState } from "@/types/tool/tool-call";

export type TraceStep =
  | {
      kind: "reasoning";
      key: "reasoning";
      text: string;
      running: boolean;
    }
  | {
      kind: "tool";
      key: string;
      toolCallId: string;
      toolName: string;
      serverName?: string;
      isMcp: boolean;
      args: unknown;
      result?: unknown;
      state: "running" | "done" | "error";
    }
  | {
      kind: "subagent";
      key: string;
      toolCallId: string;
      role: string;
      agentId?: string;
      agentName?: string;
      taskBrief: string;
      inputData?: string;
      result?: unknown;
      state: "running" | "done" | "error";
    };

export interface BuildTraceStepsParams {
  reasoning?: string;
  isStreamingReasoning?: boolean;
  activeToolCalls?: ToolCallState[];
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
}

function isErrorResult(result: unknown): boolean {
  if (!result || typeof result !== "object") return false;
  const obj = result as Record<string, unknown>;
  return obj.error !== undefined || obj.isError === true;
}

function parseArgsObject(args: unknown): Record<string, unknown> {
  if (args && typeof args === "object") {
    return args as Record<string, unknown>;
  }
  if (typeof args === "string") {
    try {
      const parsed = JSON.parse(args);
      if (parsed && typeof parsed === "object") {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Ignore parse failure
    }
  }
  return {};
}

function extractSubagentParams(args: unknown): {
  role: string;
  agentId?: string;
  agentName?: string;
  taskBrief: string;
  inputData?: string;
} {
  const obj = parseArgsObject(args);
  const agentId =
    typeof obj.agent === "string" && obj.agent ? obj.agent : undefined;
  const role =
    typeof obj.role === "string" && obj.role ? obj.role : (agentId ?? "worker");
  const resolvedBuiltIn = agentId
    ? resolveBuiltInAgentByRoleOrId(agentId)
    : undefined;
  const agentName =
    typeof obj.agentName === "string" && obj.agentName
      ? obj.agentName
      : resolvedBuiltIn?.name;
  const taskBrief =
    typeof obj.taskBrief === "string" && obj.taskBrief
      ? obj.taskBrief
      : typeof obj.task === "string" && obj.task
        ? obj.task
        : "Task execution";
  const inputData =
    typeof obj.inputData === "string"
      ? obj.inputData
      : typeof obj.input === "string"
        ? obj.input
        : undefined;

  return { role, agentId, agentName, taskBrief, inputData };
}

function resolveStepState(
  isRunning: boolean,
  result: unknown,
): "running" | "done" | "error" {
  if (isRunning) return "running";
  if (result === undefined || isErrorResult(result)) return "error";
  return "done";
}

interface CreateToolOrSubagentStepParams {
  key: string;
  toolCallId: string;
  toolName: string;
  serverName?: string;
  args: unknown;
  result?: unknown;
  state: "running" | "done" | "error";
}

function createToolOrSubagentStep({
  key,
  toolCallId,
  toolName,
  serverName,
  args,
  result,
  state,
}: CreateToolOrSubagentStepParams): TraceStep {
  if (toolName === "delegate_task") {
    const { role, agentId, agentName, taskBrief, inputData } =
      extractSubagentParams(args);
    return {
      kind: "subagent",
      key,
      toolCallId,
      role,
      ...(agentId ? { agentId } : {}),
      ...(agentName ? { agentName } : {}),
      taskBrief,
      inputData,
      result,
      state,
    };
  }

  return {
    kind: "tool",
    key,
    toolCallId,
    toolName,
    serverName,
    isMcp: Boolean(serverName),
    args,
    result,
    state,
  };
}

function buildActiveTraceSteps(activeToolCalls: ToolCallState[]): TraceStep[] {
  const steps: TraceStep[] = [];
  for (const tc of activeToolCalls) {
    const isRunning = tc.status === "calling";
    const state = resolveStepState(isRunning, tc.result);
    steps.push(
      createToolOrSubagentStep({
        key: `active-${tc.toolCallId}`,
        toolCallId: tc.toolCallId,
        toolName: tc.toolName,
        serverName: tc.serverName,
        args: tc.args,
        result: tc.result,
        state,
      }),
    );
  }
  return steps;
}

function buildPersistedTraceSteps(
  toolCalls: ToolCall[],
  toolResults?: ToolResult[],
): TraceStep[] {
  const steps: TraceStep[] = [];
  const resultsMap = new Map<string, ToolResult>();
  if (toolResults) {
    for (const tr of toolResults) {
      resultsMap.set(tr.toolCallId, tr);
    }
  }

  for (const tc of toolCalls) {
    const tr = resultsMap.get(tc.toolCallId);
    const serverName = tc.serverName ?? tr?.serverName;
    const result = tr?.result;
    const state = resolveStepState(false, result);

    steps.push(
      createToolOrSubagentStep({
        key: `persisted-${tc.toolCallId}`,
        toolCallId: tc.toolCallId,
        toolName: tc.toolName,
        serverName,
        args: tc.args,
        result,
        state,
      }),
    );
  }
  return steps;
}

/**
 * Normalizes streaming state and persisted message metadata into a uniform sequence of trace steps.
 *
 * @param params - Generation parameters including reasoning, active streaming tools, or persisted tools
 * @returns Ordered array of trace steps to render inside a Trace container
 * @author Maruf Bepary
 */
export function buildTraceSteps({
  reasoning,
  isStreamingReasoning,
  activeToolCalls,
  toolCalls,
  toolResults,
}: BuildTraceStepsParams): TraceStep[] {
  const steps: TraceStep[] = [];

  const text = reasoning ?? "";
  const runningReasoning = Boolean(isStreamingReasoning);
  if (text.trim().length > 0 || runningReasoning) {
    steps.push({
      kind: "reasoning",
      key: "reasoning",
      text,
      running: runningReasoning,
    });
  }

  if (activeToolCalls && activeToolCalls.length > 0) {
    steps.push(...buildActiveTraceSteps(activeToolCalls));
    return steps;
  }

  if (toolCalls && toolCalls.length > 0) {
    steps.push(...buildPersistedTraceSteps(toolCalls, toolResults));
  }

  return steps;
}
