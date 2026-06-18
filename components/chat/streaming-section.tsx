"use client";

import type { ToolCallState } from "@/types/tool/tool-call";
import type { Citation } from "@/lib/store/mappers/message-mapper";
import type { Message } from "@/types/message/message";
import { StreamingPlaceholder } from "./message/streaming-placeholder";
import { MessageBubble } from "./message-bubble";

/**
 * Props for the StreamingSection component.
 */
interface StreamingSectionProps {
  /** True while the AI is generating a response. */
  isLoading: boolean;
  /** The accumulated text content being streamed, or null if not yet started. */
  streamingContent: string | null;
  /** The accumulated reasoning/thinking tokens being streamed. */
  streamingReasoning: string | null;
  /** True while reasoning tokens are actively streaming. */
  isStreamingReasoning: boolean;
  /** Tool invocations currently in flight. */
  activeToolCalls: ToolCallState[];
  /** Citations extracted from completed search tool calls. */
  streamingCitations: Citation[];
}

/**
 * Renders the streaming response area below the existing message thread.
 * Shows a loading placeholder while waiting for the first token, active tool
 * call status messages, and a streaming MessageBubble once content arrives.
 *
 * @param props - Streaming state and tool call tracking.
 * @returns A fragment containing the loading indicator, tool call statuses,
 *          and the streaming message bubble as applicable.
 */
export function StreamingSection({
  isLoading,
  streamingContent,
  streamingReasoning,
  isStreamingReasoning,
  activeToolCalls,
  streamingCitations,
}: StreamingSectionProps) {
  const hasStreamingContent =
    streamingContent !== null ||
    streamingReasoning !== null ||
    streamingCitations.length > 0;

  if (
    !isLoading &&
    streamingContent === null &&
    streamingReasoning === null &&
    activeToolCalls.length === 0
  ) {
    return null;
  }

  return (
    <>
      {isLoading &&
        streamingContent === null &&
        streamingReasoning === null &&
        activeToolCalls.length === 0 && <StreamingPlaceholder />}

      {activeToolCalls.length > 0 && (
        <div className="text-muted-foreground text-sm space-y-1 ml-2">
          {activeToolCalls.map((tc) => (
            <div key={tc.toolCallId}>
              {tc.status === "calling"
                ? `🔧 Calling ${tc.toolName}…`
                : `✅ ${tc.toolName} complete`}
            </div>
          ))}
        </div>
      )}

      {hasStreamingContent && (
        <MessageBubble
          message={{
            id: "streaming",
            role: "assistant",
            content: streamingContent ?? "",
            createdAt: new Date(),
            parentId: null,
            childrenIds: [],
            metadata: null,
          }}
          isLatest={true}
          onDelete={() => {}}
          onEdit={() => {}}
          siblings={[]}
          currentSiblingIndex={0}
          onNavigateBranch={() => {}}
          reasoning={streamingReasoning ?? undefined}
          isStreamingReasoning={isStreamingReasoning}
          streamingCitations={streamingCitations}
        />
      )}
    </>
  );
}
