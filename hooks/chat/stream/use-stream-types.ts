import type { Attachment } from "@/types/attachment/attachment";
import type { ToolCallState } from "@/types/tool/tool-call";

/**
 * Substring patterns that indicate an access-denied or non-existent chat session.
 *
 * @author Maruf Bepary
 */
export const ACCESS_OR_NOT_FOUND_PATTERNS = [
  "Not Found",
  "Unauthorized",
  "access denied",
] as const;

/**
 * Options required to construct turn message metadata for persistence.
 *
 * @author Maruf Bepary
 */
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

/**
 * Mutable ref bundle for saving and restoring in-flight stream state.
 *
 * @author Maruf Bepary
 */
export interface CachedStreamStateRefs {
  accumulatedTextRef: { current: string };
  accumulatedReasoningRef: { current: string };
  activeToolCallsRef: { current: ToolCallState[] };
  assistantMessageIdRef: { current: string | null };
}

/**
 * State dispatch setters for restoring in-flight stream UI states.
 *
 * @author Maruf Bepary
 */
export interface CachedStreamStateSetters {
  setStreamingContent: (text: string | null) => void;
  setStreamingReasoning: (reasoning: string | null) => void;
  setActiveToolCalls: (calls: ToolCallState[]) => void;
  setAssistantMessageId: (id: string | null) => void;
}

/**
 * Options supplied to dispatch a chat generation stream request.
 *
 * @author Maruf Bepary
 */
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

/**
 * Mutable refs tracked during SSE delta application.
 *
 * @author Maruf Bepary
 */
export interface StreamDeltaRefs {
  lastChunkTimeRef: { current: number };
  assistantMessageIdRef: { current: string | null };
  accumulatedTextRef: { current: string };
  accumulatedReasoningRef: { current: string };
  activeToolCallsRef: { current: ToolCallState[] };
}

/**
 * React state setters invoked during SSE delta processing.
 *
 * @author Maruf Bepary
 */
export interface StreamDeltaSetters {
  setAssistantMessageId: (id: string | null) => void;
  setStreamingContent: (text: string | null) => void;
  setStreamingReasoning: (reasoning: string | null) => void;
  setActiveToolCalls: (calls: ToolCallState[]) => void;
  setIsStreaming: (is: boolean) => void;
}

/**
 * Tracks in-flight request identity prior to server confirmation.
 *
 * @author Maruf Bepary
 */
export interface PendingRefState {
  userMessageId: string | null;
  model: string;
  startTime: number;
}

/**
 * Combined stream state references passed across streaming hooks.
 *
 * @author Maruf Bepary
 */
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

/**
 * Parameters for executing a full turn dispatch and response consumption flow.
 *
 * @author Maruf Bepary
 */
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
