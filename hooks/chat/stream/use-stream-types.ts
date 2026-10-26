import type { Attachment } from "@/types/attachment/attachment";
import type { ToolCallState } from "@/types/tool/tool-call";

export const ACCESS_OR_NOT_FOUND_PATTERNS = [
  "Not Found",
  "Unauthorized",
  "access denied",
] as const;

export interface BuildMetadataOptions {
  model: string;
  selectedServerIds: string[];
  selectedTools: string[];
  selectedAssistantId?: string;
  selectedKbIds?: string[];
  selectedSkillIds?: string[];
  subagentsEnabled?: boolean;
  subagentModelId?: string;
}

export interface CachedStreamStateRefs {
  accumulatedTextRef: { current: string };
  accumulatedReasoningRef: { current: string };
  activeToolCallsRef: { current: ToolCallState[] };
  assistantMessageIdRef: { current: string | null };
}

export interface CachedStreamStateSetters {
  setStreamingContent: (text: string | null) => void;
  setStreamingReasoning: (reasoning: string | null) => void;
  setActiveToolCalls: (calls: ToolCallState[]) => void;
  setAssistantMessageId: (id: string | null) => void;
}

export interface StreamRequestOptions {
  chatId: string;
  userMessageId: string;
  model?: string;
  selectedServerIds?: string[];
  selectedTools?: string[];
  selectedAssistantId?: string;
  selectedSkillIds?: string[];
  selectedKbIds?: string[];
  subagentsEnabled?: boolean;
  subagentModelId?: string;
}

export interface StreamDeltaRefs {
  lastChunkTimeRef: { current: number };
  assistantMessageIdRef: { current: string | null };
  accumulatedTextRef: { current: string };
  accumulatedReasoningRef: { current: string };
  activeToolCallsRef: { current: ToolCallState[] };
}

export interface StreamDeltaSetters {
  setAssistantMessageId: (id: string | null) => void;
  setStreamingContent: (text: string | null) => void;
  setStreamingReasoning: (reasoning: string | null) => void;
  setActiveToolCalls: (calls: ToolCallState[]) => void;
  setIsStreaming: (is: boolean) => void;
}

export interface PendingRefState {
  userMessageId: string | null;
  model: string;
  startTime: number;
}

export interface StreamRefsObject {
  pendingRef: { current: PendingRefState };
  lastChunkTimeRef: { current: number };
  accumulatedTextRef: { current: string };
  accumulatedReasoningRef: { current: string };
  assistantMessageIdRef: { current: string | null };
  activeToolCallsRef: { current: ToolCallState[] };
  stoppedRef: { current: boolean };
  rejoinedRef: { current: boolean };
  checkedChatIdRef: { current: string | null };
}

export interface StreamResponseExecutionParams {
  chatId: string;
  userMsgId: string;
  content: string;
  parentId: string | null;
  attachments: Attachment[];
  model: string;
  selectedServerIds: string[];
  selectedTools: string[];
  selectedPromptIds: string[];
  selectedAssistantId?: string;
  selectedKbIds: string[];
  selectedSkillIds: string[];
  subagentsEnabled?: boolean;
  subagentModelId?: string;
  addMessage: (chatId: string, message: any) => void;
  updateMessageAttachments: (
    chatId: string,
    messageId: string,
    attachments: Attachment[],
  ) => void;
  handleApiError: (err: unknown) => boolean;
  resetStreamingState: () => void;
  setIsStreaming: (is: boolean) => void;
  setChatNotFound: (notFound: boolean) => void;
  refs: StreamRefsObject;
}
