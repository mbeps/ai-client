"use client";

import type { ArtifactData } from "@/types/artifact/artifact-data";
import type { Citation } from "@/types/chat/citation";
import type { ToolCallState } from "@/types/tool/tool-call";
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
  /** Callback to toggle a canvas artifact. */
  onToggleArtifact?: (artifact: ArtifactData) => void;
  /** Active artifact id if canvas is currently open. */
  activeArtifactId?: string | null;
  /** Whether canvas panel is currently open. */
  isCanvasOpen?: boolean;
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
  onToggleArtifact,
  activeArtifactId,
  isCanvasOpen,
}: StreamingSectionProps) {
  const hasStreamingContent =
    streamingContent !== null ||
    streamingReasoning !== null ||
    streamingCitations.length > 0 ||
    activeToolCalls.length > 0;

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
          activeToolCalls={activeToolCalls}
          onToggleArtifact={onToggleArtifact}
          activeArtifactId={activeArtifactId}
          isCanvasOpen={isCanvasOpen}
        />
      )}
    </>
  );
}
