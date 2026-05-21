"use client";

import type { ToolCall, ToolResult } from "@/lib/store/mappers/message-mapper";
import { ThinkingDisplay } from "./thinking-display";
import { ToolCallDisplay } from "./tool-call-display";
import { useMemo } from "react";

interface ResponseTimelineProps {
  reasoning?: string;
  isStreamingReasoning?: boolean;
  toolCalls?: ToolCall[];
  toolResults?: ToolResult[];
  isLatest?: boolean;
}

export function ResponseTimeline({
  reasoning,
  isStreamingReasoning,
  toolCalls,
  toolResults,
  isLatest,
}: ResponseTimelineProps) {
  // Currently, we don't have true interleaving from the backend yet,
  // so we'll group them: Thinking first, then Tool Calls.
  // This structure allows us to easily add interleaved support later if the backend emits sequential steps.

  const steps = useMemo(() => {
    const items: React.ReactNode[] = [];
    let stepCount = 0;

    // 1. Thinking Step
    if (reasoning || isStreamingReasoning) {
      stepCount++;
      items.push(
        <ThinkingDisplay
          key="thinking"
          reasoning={reasoning ?? ""}
          isStreaming={isStreamingReasoning}
          initialOpen={isLatest && !!reasoning}
          stepNumber={stepCount}
        />,
      );
    }

    // 2. Tool Calls Step
    if (toolCalls && toolCalls.length > 0) {
      items.push(
        <ToolCallDisplay
          key="tools"
          toolCalls={toolCalls}
          toolResults={toolResults ?? []}
        />,
      );
    }

    return items;
  }, [reasoning, isStreamingReasoning, toolCalls, toolResults, isLatest]);

  if (steps.length === 0) return null;

  return <div className="space-y-2">{steps}</div>;
}
