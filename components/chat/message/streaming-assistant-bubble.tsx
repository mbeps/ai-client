"use client";

import { useMemo } from "react";
import { AssistantMessageBody } from "@/components/chat/message/assistant-message-body";
import { CitationsList } from "@/components/chat/message/citations-list";
import { MessageHeader } from "@/components/chat/message/message-bubble-header";
import { MessageTimelineSection } from "@/components/chat/message/message-timeline-section";
import { SITE_CONFIG } from "@/config/site";
import { extractMessageArtifacts } from "@/lib/chat/extract-message-artifacts";
import { extractMessageDownloads } from "@/lib/chat/extract-message-downloads";
import type { ArtifactData } from "@/types/artifact/artifact-data";
import type { Citation } from "@/types/chat/citation";
import type { ToolCallState } from "@/types/tool/tool-call";

/**
 * Props for the StreamingAssistantBubble component.
 *
 * @author Maruf Bepary
 */
export interface StreamingAssistantBubbleProps {
  /** Optional chat ID for scratchpad authorization. */
  chatId?: string;
  /** The accumulated streaming content. */
  content: string;
  /** Accumulated reasoning tokens. */
  reasoning?: string;
  /** Whether reasoning is currently streaming. */
  isStreamingReasoning?: boolean;
  /** Real-time in-flight tool calls. */
  activeToolCalls?: ToolCallState[];
  /** Citations gathered during search tool calls. */
  streamingCitations?: Citation[];
  /** Callback to toggle a canvas artifact. */
  onToggleArtifact?: (artifact: ArtifactData) => void;
  /** Active artifact id if canvas is currently open. */
  activeArtifactId?: string | null;
  /** Whether canvas panel is currently open. */
  isCanvasOpen?: boolean;
  /** Optional assistant message ID generated during streaming. */
  assistantMessageId?: string | null;
  /** Optional assistant name for the header. */
  assistantName?: string;
  /** Optional selected model name for the header. */
  selectedModelName?: string;
}

/**
 * Dedicated presentation component for an active in-flight assistant response.
 * Renders the assistant header, timeline section, message body, and citations
 * without constructing a fake Message object or dummy callback handlers.
 *
 * @param props - Presentation and streaming data.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
export function StreamingAssistantBubble({
  chatId,
  content,
  reasoning,
  isStreamingReasoning,
  activeToolCalls,
  streamingCitations = [],
  onToggleArtifact,
  activeArtifactId,
  isCanvasOpen,
  assistantMessageId,
  assistantName,
  selectedModelName,
}: StreamingAssistantBubbleProps) {
  const messageId = assistantMessageId || "streaming";

  const messageTarget = useMemo(
    () => ({
      id: messageId,
      role: "assistant" as const,
      content,
      metadata: null,
    }),
    [messageId, content],
  );

  const messageArtifacts = useMemo(
    () => extractMessageArtifacts(messageTarget, activeToolCalls),
    [messageTarget, activeToolCalls],
  );

  const messageDownloads = useMemo(
    () => extractMessageDownloads(messageTarget, activeToolCalls),
    [messageTarget, activeToolCalls],
  );

  return (
    <div
      data-testid="streaming-assistant-bubble"
      className="group bg-muted/30 flex w-full flex-col gap-2 rounded-lg p-4"
    >
      <MessageHeader
        isUser={false}
        assistantName={
          assistantName ??
          selectedModelName ??
          SITE_CONFIG.DEFAULT_ASSISTANT_NAME
        }
      />

      <div className="flex-1 overflow-hidden">
        <div className="text-sm">
          <MessageTimelineSection
            isUser={false}
            reasoning={reasoning}
            isStreamingReasoning={isStreamingReasoning}
            toolData={null}
            activeToolCalls={activeToolCalls}
            messageId={messageId}
            chatId={chatId}
          />

          <AssistantMessageBody
            messageArtifacts={messageArtifacts}
            messageDownloads={messageDownloads}
            content={content}
            isCanvasOpen={isCanvasOpen}
            activeArtifactId={activeArtifactId}
            onToggleArtifact={onToggleArtifact}
          />

          <CitationsList citations={streamingCitations} />
        </div>
      </div>
    </div>
  );
}
