"use client";

import { ResponseTimeline } from "@/components/chat/message/response-timeline";
import type { ParsedMessageMetadata } from "@/types/message/metadata";
import type { ToolCallState } from "@/types/tool/tool-call";

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
