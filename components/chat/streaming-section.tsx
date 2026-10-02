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
  /**
   * How many tool calls are waiting on a decision.
   *
   * The count is enough, and the approvals themselves are deliberately not
   * passed: the gate belongs to the committed assistant row, so this section
   * only needs to know it should stay out of the way.
   */
  pendingApprovalsCount?: number;
}

/**
 * Renders the streaming response area below the existing message thread.
 * Shows a loading placeholder while waiting for the first token, active tool
 * call status messages, and a streaming MessageBubble once content arrives.
 *
 * The approval gate is deliberately absent here. It belongs to the assistant
 * row in the thread, which reads it from persisted metadata; rendering it on
 * this transient bubble as well made two bubbles answer one round.
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
  pendingApprovalsCount = 0,
}: StreamingSectionProps) {
  // A parked round leaves isLoading true with no streamed text, because the
  // tool call is the only thing that has happened. The committed assistant
  // row already renders that call from persisted metadata, so drawing it here
  // too would show the same round twice.
  const isParked = pendingApprovalsCount > 0;

  const hasStreamingContent =
    streamingContent !== null ||
    streamingReasoning !== null ||
    streamingCitations.length > 0 ||
    (activeToolCalls.length > 0 && !isParked);

  if (
    !isLoading &&
    streamingContent === null &&
    streamingReasoning === null &&
    activeToolCalls.length === 0
  ) {
    return null;
  }

  // Nothing new is streaming, and the gate has its own home on the thread.
  if (!hasStreamingContent) {
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
