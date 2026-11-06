"use client";

import { StreamingAssistantBubble } from "@/components/chat/message/streaming-assistant-bubble";
import { StreamingPlaceholder } from "@/components/chat/message/streaming-placeholder";
import type { ArtifactData } from "@/types/artifact/artifact-data";
import type { Citation } from "@/types/chat/citation";
import type { ToolCallState } from "@/types/tool/tool-call";

/**
 * Props for the StreamingSection component.
 */
export interface StreamingSectionProps {
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
  /** Optional chat ID for scratchpad authorization. */
  chatId?: string;
  /** Optional assistant message ID generated during streaming. */
  assistantMessageId?: string | null;
  /** Optional assistant name for the header. */
  assistantName?: string;
  /** Optional selected model name for the header. */
  selectedModelName?: string;
}

/**
 * Evaluates whether any stream output or in-flight tool call should be rendered.
 *
 * @param params - Content streams and active tool call states.
 * @returns True if any stream content or active tool call exists.
 * @author Maruf Bepary
 */
export function hasRenderableStreamContent({
  streamingContent,
  streamingReasoning,
  streamingCitations,
  activeToolCalls,
}: {
  streamingContent: string | null;
  streamingReasoning: string | null;
  streamingCitations: Citation[];
  activeToolCalls: ToolCallState[];
}): boolean {
  return (
    streamingContent !== null ||
    streamingReasoning !== null ||
    streamingCitations.length > 0 ||
    activeToolCalls.length > 0
  );
}

/**
 * Renders the streaming response area below the existing message thread.
 * Shows a loading placeholder while waiting for the first token, active tool
 * call status messages, and a streaming assistant bubble once content arrives.
 *
 * @param props - Streaming state and tool call tracking.
 * @returns A fragment containing the loading indicator or streaming bubble,
 *          or null if inactive.
 * @author Maruf Bepary
 */
export function StreamingSection(props: StreamingSectionProps) {
  const {
    isLoading,
    streamingContent,
    streamingReasoning,
    isStreamingReasoning,
    activeToolCalls,
    streamingCitations,
    onToggleArtifact,
    activeArtifactId,
    isCanvasOpen,
    chatId,
    assistantMessageId,
    assistantName,
    selectedModelName,
  } = props;

  const hasContent = hasRenderableStreamContent({
    streamingContent,
    streamingReasoning,
    streamingCitations,
    activeToolCalls,
  });

  if (!isLoading && !hasContent) {
    return null;
  }

  return (
    <>
      {isLoading && !hasContent && <StreamingPlaceholder />}

      {hasContent && (
        <StreamingAssistantBubble
          chatId={chatId}
          content={streamingContent ?? ""}
          reasoning={streamingReasoning ?? undefined}
          isStreamingReasoning={isStreamingReasoning}
          activeToolCalls={activeToolCalls}
          streamingCitations={streamingCitations}
          onToggleArtifact={onToggleArtifact}
          activeArtifactId={activeArtifactId}
          isCanvasOpen={isCanvasOpen}
          assistantMessageId={assistantMessageId}
          assistantName={assistantName ?? selectedModelName}
          selectedModelName={selectedModelName}
        />
      )}
    </>
  );
}
