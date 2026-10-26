"use client";

import { ResponseTimeline } from "@/components/chat/message/response-timeline";
import type { ParsedMessageMetadata } from "@/types/message/metadata";
import type { ToolCallState } from "@/types/tool/tool-call";

/**
 * Represents message timeline section props.
 *
 * @author Maruf Bepary
 */
interface MessageTimelineSectionProps {
  isUser: boolean;
  reasoning?: string;
  isStreamingReasoning?: boolean;
  toolData: ParsedMessageMetadata["toolData"];
  activeToolCalls?: ToolCallState[];
  isLatest: boolean;
  messageId: string;
  chatId?: string;
}

/**
 * Renders the message timeline section component.
 *
 * @param props - Component properties.
 * @returns The rendered JSX element.
 * @author Maruf Bepary
 */
export function MessageTimelineSection({
  isUser,
  reasoning,
  isStreamingReasoning,
  toolData,
  activeToolCalls,
  isLatest,
  messageId,
  chatId,
}: MessageTimelineSectionProps) {
  if (isUser) return null;
  return (
    <ResponseTimeline
      reasoning={reasoning}
      isStreamingReasoning={isStreamingReasoning}
      toolCalls={toolData?.toolCalls}
      toolResults={toolData?.toolResults}
      activeToolCalls={activeToolCalls}
      isLatest={isLatest}
      messageId={messageId}
      chatId={chatId}
    />
  );
}
