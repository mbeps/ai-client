"use client";

import { useMemo } from "react";
import { ReasoningTraceStep } from "@/components/chat/message/reasoning-trace-step";
import { SubagentTraceStep } from "@/components/chat/message/subagent-trace-step";
import { ToolTraceStep } from "@/components/chat/message/tool-trace-step";
import { Trace } from "@/components/ui/trace";
import { buildTraceSteps } from "@/lib/chat/build-trace-steps";
import type { ToolCall } from "@/types/chat/tool-call";
import type { ToolResult } from "@/types/chat/tool-result";
import type { ToolCallState } from "@/types/tool/tool-call";

/**
 * Properties for the ResponseTimeline trace view container.
 */
export interface ResponseTimelineProps {
  reasoning?: string;
  isStreamingReasoning?: boolean;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  activeToolCalls?: ToolCallState[];
  messageId?: string;
  chatId?: string;
}

/**
 * Displays a unified timeline of assistant response trace steps: reasoning, tools, and subagents.
 *
 * @author Maruf Bepary
 */
export function ResponseTimeline({
  reasoning,
  isStreamingReasoning,
  toolCalls,
  toolResults,
  activeToolCalls,
  messageId,
  chatId,
}: ResponseTimelineProps) {
  const steps = useMemo(
    () =>
      buildTraceSteps({
        reasoning,
        isStreamingReasoning,
        activeToolCalls,
        toolCalls,
        toolResults,
      }),
    [reasoning, isStreamingReasoning, activeToolCalls, toolCalls, toolResults],
  );

  if (steps.length === 0) return null;

  return (
    <Trace className="mb-3">
      {steps.map((step) => {
        if (step.kind === "reasoning") {
          return (
            <ReasoningTraceStep
              key={step.key}
              text={step.text}
              running={step.running}
            />
          );
        }
        if (step.kind === "subagent") {
          return (
            <SubagentTraceStep
              key={step.key}
              toolCallId={step.toolCallId}
              role={step.role}
              taskBrief={step.taskBrief}
              inputData={step.inputData}
              result={step.result}
              state={step.state}
              messageId={messageId}
              chatId={chatId}
            />
          );
        }
        return (
          <ToolTraceStep
            key={step.key}
            toolCallId={step.toolCallId}
            toolName={step.toolName}
            serverName={step.serverName}
            isMcp={step.isMcp}
            args={step.args}
            result={step.result}
            state={step.state}
          />
        );
      })}
    </Trace>
  );
}
