import type { Attachment } from "@/types/attachment/attachment";

/**
 * Payload sent to the /api/chat SSE endpoint.
 */
export interface StreamRequestPayload {
  chatId: string;
  userMessageId: string;
  messages: Array<{
    role: string;
    content: string;
    attachments?: Array<{
      id: string;
      type: string;
      dataUrl: string;
      name: string;
      mimeType: string;
      extractedText?: string;
      key?: string;
    }>;
    metadata?: string;
  }>;
  model: string;
  selectedServerIds: string[];
  selectedTools: string[];
  selectedAssistantId?: string;
  selectedKbIds: string[];
}

/**
 * Builds the JSON-serialisable request body for the /api/chat SSE endpoint.
 * This is a pure data transform — no side effects.
 */
export function buildStreamRequestBody(params: {
  chatId: string;
  userMessageId: string;
  messages: Array<{
    role: string;
    content: string;
    attachments?: Attachment[];
    metadata?: string;
  }>;
  model: string;
  selectedServerIds: string[];
  selectedTools: string[];
  selectedAssistantId?: string;
  selectedKbIds: string[];
}): StreamRequestPayload {
  return {
    chatId: params.chatId,
    userMessageId: params.userMessageId,
    messages: params.messages.map((m) => ({
      role: m.role,
      content: m.content,
      attachments: m.attachments?.map((att) => ({
        id: att.id,
        type: att.type,
        dataUrl: att.dataUrl,
        name: att.name,
        mimeType: att.mimeType,
        extractedText: att.extractedText,
        key: att.key,
      })),
      metadata: m.metadata,
    })),
    model: params.model,
    selectedServerIds: params.selectedServerIds,
    selectedTools: params.selectedTools,
    selectedAssistantId: params.selectedAssistantId,
    selectedKbIds: params.selectedKbIds,
  };
}
